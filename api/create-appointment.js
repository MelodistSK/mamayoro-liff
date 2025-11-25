// Vercel Serverless Function - Create Appointment
// 面談予約を作成してkintoneとGoogleカレンダーに登録

import { google } from 'googleapis';

export default async function handler(req, res) {
    // CORSヘッダーを設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('========================================');
    console.log('Create Appointment API called');
    console.log('========================================');

    try {
        const { lineUserId, date, startTime, endTime } = req.body;

        if (!lineUserId || !date || !startTime) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        console.log('Line User ID:', lineUserId);
        console.log('Date:', date);
        console.log('Time:', startTime, '-', endTime);

        // kintone設定
        const KINTONE_DOMAIN = '0ioyx3apbzda.cybozu.com';
        const JOBSEEKER_APP_ID = '801';
        const APPOINTMENT_APP_ID = '805';
        // 両方のアプリのAPIトークンを組み合わせて使用（ルックアップのため）
        const JOBSEEKER_API_TOKEN = 'ObIT9Awe9J1UPOvksMbOZp2i0LP3fImDvlFP4gpT';
        const APPOINTMENT_API_TOKEN = 'JhYRH8PqA3cPsUo0X1ZqPtOpXqwMoJSHpF0pxH8y';
        const COMBINED_API_TOKEN = `${JOBSEEKER_API_TOKEN},${APPOINTMENT_API_TOKEN}`;

        // Step 1: LINE User IDで求職者を検索
        console.log('Step 1: Searching for jobseeker by LINE User ID...');
        
        const searchUrl = `https://${KINTONE_DOMAIN}/k/v1/records.json?app=${JOBSEEKER_APP_ID}&query=line_user_id%3D%22${lineUserId}%22`;
        
        const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'X-Cybozu-API-Token': JOBSEEKER_API_TOKEN
            }
        });

        if (!searchResponse.ok) {
            const errorData = await searchResponse.json();
            console.log('Search Error:', JSON.stringify(errorData));
            throw new Error('Failed to search jobseeker');
        }

        const searchData = await searchResponse.json();
        
        if (!searchData.records || searchData.records.length === 0) {
            console.log('Error: Jobseeker not found');
            return res.status(404).json({ error: 'Jobseeker not found. Please register first.' });
        }

        const jobseeker = searchData.records[0];
        const jobseekerId = jobseeker.jobseeker_id?.value;
        const jobseekerName = `${jobseeker.last_name?.value || ''}${jobseeker.first_name?.value || ''}`;
        const jobseekerRecordId = jobseeker.$id?.value;

        console.log('Found jobseeker:', jobseekerName);
        console.log('Jobseeker ID:', jobseekerId);

        // Step 2: 面談IDを生成
        console.log('Step 2: Generating appointment ID...');
        
        const getAppointmentsUrl = `https://${KINTONE_DOMAIN}/k/v1/records.json?app=${APPOINTMENT_APP_ID}&query=order%20by%20%24id%20desc%20limit%201`;
        
        const getAppointmentsResponse = await fetch(getAppointmentsUrl, {
            method: 'GET',
            headers: {
                'X-Cybozu-API-Token': APPOINTMENT_API_TOKEN
            }
        });

        let nextAppointmentNum = 1;
        if (getAppointmentsResponse.ok) {
            const appointmentsData = await getAppointmentsResponse.json();
            if (appointmentsData.records && appointmentsData.records.length > 0) {
                const lastRecord = appointmentsData.records[0];
                nextAppointmentNum = parseInt(lastRecord.$id?.value || '0', 10) + 1;
            }
        }

        const appointmentId = `INT-${String(nextAppointmentNum).padStart(7, '0')}`;
        console.log('Generated Appointment ID:', appointmentId);

        // Step 3: kintone面談管理アプリにレコード作成
        console.log('Step 3: Creating appointment record in kintone...');

        const appointmentRecord = {
            appointment_id: { value: appointmentId },
            jobseeker_id_lookup: { value: jobseekerId },  // ルックアップフィールド
            appointment_date: { value: date },
            appointment_time: { value: startTime },
            appointment_end_time: { value: endTime || '' },
            status: { value: '予約確定' },
            appointment_method: { value: 'オンライン' }
        };

        const createAppointmentUrl = `https://${KINTONE_DOMAIN}/k/v1/record.json`;
        
        const createAppointmentResponse = await fetch(createAppointmentUrl, {
            method: 'POST',
            headers: {
                'X-Cybozu-API-Token': COMBINED_API_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                app: APPOINTMENT_APP_ID,
                record: appointmentRecord
            })
        });

        if (!createAppointmentResponse.ok) {
            const errorData = await createAppointmentResponse.json();
            console.log('Create Appointment Error:', JSON.stringify(errorData));
            throw new Error(errorData.message || 'Failed to create appointment record');
        }

        const appointmentResult = await createAppointmentResponse.json();
        const appointmentRecordId = appointmentResult.id;
        console.log('Appointment record created. Record ID:', appointmentRecordId);

        // Step 4: Googleカレンダーに予定を追加
        console.log('Step 4: Creating Google Calendar event...');

        let calendarEventId = null;

        try {
            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
            
            if (credentials.client_email) {
                const auth = new google.auth.GoogleAuth({
                    credentials: credentials,
                    scopes: ['https://www.googleapis.com/auth/calendar']
                });

                const calendar = google.calendar({ version: 'v3', auth });
                const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

                // 日時を作成
                const startDateTime = `${date}T${startTime}:00+09:00`;
                const endDateTime = endTime 
                    ? `${date}T${endTime}:00+09:00`
                    : new Date(new Date(startDateTime).getTime() + 30 * 60000).toISOString();

                // kintoneレコードへのリンク
                const kintoneJobseekerUrl = `https://${KINTONE_DOMAIN}/k/${JOBSEEKER_APP_ID}/show#record=${jobseekerRecordId}`;
                const kintoneAppointmentUrl = `https://${KINTONE_DOMAIN}/k/${APPOINTMENT_APP_ID}/show#record=${appointmentRecordId}`;

                const event = {
                    summary: `${jobseekerName}_#${appointmentId}#`,
                    description: `【面談情報】\n面談ID: ${appointmentId}\n\n【求職者情報】\n求職者ID: ${jobseekerId}\n氏名: ${jobseekerName}\n\n【リンク】\n面談レコード: ${kintoneAppointmentUrl}\n求職者レコード: ${kintoneJobseekerUrl}`,
                    start: {
                        dateTime: startDateTime,
                        timeZone: 'Asia/Tokyo'
                    },
                    end: {
                        dateTime: endDateTime,
                        timeZone: 'Asia/Tokyo'
                    }
                };

                const calendarResponse = await calendar.events.insert({
                    calendarId: calendarId,
                    resource: event
                });

                calendarEventId = calendarResponse.data.id;
                console.log('Calendar event created. Event ID:', calendarEventId);

                // Step 5: kintoneにカレンダーイベントIDを保存
                console.log('Step 5: Updating kintone record with calendar event ID...');

                const updateUrl = `https://${KINTONE_DOMAIN}/k/v1/record.json`;
                
                await fetch(updateUrl, {
                    method: 'PUT',
                    headers: {
                        'X-Cybozu-API-Token': APPOINTMENT_API_TOKEN,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        app: APPOINTMENT_APP_ID,
                        id: appointmentRecordId,
                        record: {
                            calendar_event_id: { value: calendarEventId }
                        }
                    })
                });

                console.log('kintone record updated with calendar event ID');
            } else {
                console.log('Google credentials not configured, skipping calendar creation');
            }
        } catch (calendarError) {
            console.log('Calendar creation error (non-fatal):', calendarError.message);
            // カレンダー作成に失敗しても予約自体は成功とする
        }

        console.log('========================================');
        console.log('Appointment created successfully!');
        console.log('========================================');

        return res.status(200).json({
            success: true,
            appointmentId: appointmentId,
            recordId: appointmentRecordId,
            calendarEventId: calendarEventId,
            jobseekerName: jobseekerName,
            date: date,
            time: startTime
        });

    } catch (error) {
        console.log('========================================');
        console.log('Create Appointment Error:', error.message);
        console.log('========================================');
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}
