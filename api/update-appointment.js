// Vercel Serverless Function - Update Appointment
// Googleカレンダーの予定を更新するAPI

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
    console.log('Update Appointment API called');
    console.log('========================================');

    try {
        const { eventId, date, startTime, endTime, title, description } = req.body;

        if (!eventId) {
            return res.status(400).json({ error: 'Event ID is required' });
        }

        console.log('Event ID:', eventId);
        console.log('New Date:', date);
        console.log('New Time:', startTime, '-', endTime);

        // Google Calendar API認証
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
        
        if (!credentials.client_email) {
            return res.status(500).json({ error: 'Google credentials not configured' });
        }

        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/calendar']
        });

        const calendar = google.calendar({ version: 'v3', auth });
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

        // 更新内容を構築
        const updateData = {};

        if (title) {
            updateData.summary = title;
        }

        if (description) {
            updateData.description = description;
        }

        if (date && startTime) {
            updateData.start = {
                dateTime: `${date}T${startTime}:00+09:00`,
                timeZone: 'Asia/Tokyo'
            };

            if (endTime) {
                updateData.end = {
                    dateTime: `${date}T${endTime}:00+09:00`,
                    timeZone: 'Asia/Tokyo'
                };
            } else {
                // endTimeが指定されていない場合、startTimeの30分後
                const startDate = new Date(`${date}T${startTime}:00+09:00`);
                const endDate = new Date(startDate.getTime() + 30 * 60000);
                updateData.end = {
                    dateTime: endDate.toISOString(),
                    timeZone: 'Asia/Tokyo'
                };
            }
        }

        console.log('Update data:', JSON.stringify(updateData));

        // カレンダーイベントを更新
        const response = await calendar.events.patch({
            calendarId: calendarId,
            eventId: eventId,
            resource: updateData
        });

        console.log('Calendar event updated successfully');
        console.log('========================================');

        return res.status(200).json({
            success: true,
            eventId: response.data.id,
            updatedEvent: {
                summary: response.data.summary,
                start: response.data.start,
                end: response.data.end
            }
        });

    } catch (error) {
        console.log('========================================');
        console.log('Update Appointment Error:', error.message);
        console.log('========================================');
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}
