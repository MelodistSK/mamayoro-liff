// Vercel Serverless Function - Google Calendar Available Slots
// 指定日の空き枠を取得するAPI

import { google } from 'googleapis';

export default async function handler(req, res) {
    // CORSヘッダーを設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('========================================');
    console.log('Get Available Slots API called');
    console.log('========================================');

    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required' });
        }

        console.log('Requested date:', date);

        // Google Calendar API認証
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
        
        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/calendar.readonly']
        });

        const calendar = google.calendar({ version: 'v3', auth });

        // カレンダーID（環境変数から取得、なければデフォルト）
        const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

        // 指定日の開始と終了時刻（日本時間）
        const startOfDay = new Date(`${date}T00:00:00+09:00`);
        const endOfDay = new Date(`${date}T23:59:59+09:00`);

        console.log('Fetching events from:', startOfDay.toISOString());
        console.log('To:', endOfDay.toISOString());

        // 既存の予定を取得
        const eventsResponse = await calendar.events.list({
            calendarId: calendarId,
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });

        const existingEvents = eventsResponse.data.items || [];
        console.log('Existing events count:', existingEvents.length);

        // 営業時間内の30分スロットを生成
        const slots = [];
        const businessStart = 10; // 10:00
        const businessEnd = 17;   // 17:00
        const slotDuration = 30;  // 30分
        const lastStartHour = 16;
        const lastStartMinute = 30; // 最終開始16:30

        for (let hour = businessStart; hour < businessEnd; hour++) {
            for (let minute = 0; minute < 60; minute += slotDuration) {
                // 最終開始時刻チェック
                if (hour > lastStartHour || (hour === lastStartHour && minute > lastStartMinute)) {
                    continue;
                }

                const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`);
                const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000);

                // 既存の予定と重複していないかチェック
                const isAvailable = !existingEvents.some(event => {
                    const eventStart = new Date(event.start.dateTime || event.start.date);
                    const eventEnd = new Date(event.end.dateTime || event.end.date);
                    
                    // 重複チェック
                    return (slotStart < eventEnd && slotEnd > eventStart);
                });

                slots.push({
                    start: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
                    end: `${String(slotEnd.getHours()).padStart(2, '0')}:${String(slotEnd.getMinutes()).padStart(2, '0')}`,
                    available: isAvailable
                });
            }
        }

        console.log('Generated slots:', slots.length);
        console.log('Available slots:', slots.filter(s => s.available).length);
        console.log('========================================');

        return res.status(200).json({
            success: true,
            date: date,
            slots: slots
        });

    } catch (error) {
        console.log('========================================');
        console.log('Get Slots Error:', error.message);
        console.log('========================================');
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}
