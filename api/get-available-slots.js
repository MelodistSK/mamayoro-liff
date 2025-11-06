/**
 * Vercel Serverless Function - 空き枠取得API
 * 
 * 機能:
 * - Googleカレンダーから指定日の予約状況を取得
 * - 営業時間内の空き枠を返す
 */

import { google } from 'googleapis';

export default async function handler(req, res) {
    // CORSヘッダー設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ error: '日付が指定されていません' });
        }
        
        // 環境変数から認証情報を取得
        const credentials = JSON.parse(process.env.GOOGLE_CALENDAR_CREDENTIALS);
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        
        // Google Calendar API認証
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        
        const calendar = google.calendar({ version: 'v3', auth });
        
        // 指定日の開始と終了を設定
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        console.log('取得期間:', startOfDay.toISOString(), '~', endOfDay.toISOString());
        
        // カレンダーから予定を取得
        const response = await calendar.events.list({
            calendarId: calendarId,
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
        });
        
        const events = response.data.items || [];
        console.log('既存の予定:', events.length, '件');
        
        // 営業時間を定義 (10:00-17:00、30分単位)
        const businessHours = {
            start: 10, // 10:00
            end: 17,   // 17:00 (最終開始16:30)
        };
        
        // 30分単位の時間枠を生成
        const timeSlots = {};
        for (let hour = businessHours.start; hour < businessHours.end; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                // 16:30が最終開始時刻
                if (hour === 16 && minute === 30) {
                    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                    timeSlots[timeStr] = true; // 空いている
                    break;
                }
                
                if (hour < 17) {
                    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                    timeSlots[timeStr] = true; // 空いている
                }
            }
        }
        
        console.log('生成した時間枠:', Object.keys(timeSlots));
        
        // 既存の予定と重複する時間枠を除外
        events.forEach(event => {
            if (!event.start || !event.start.dateTime) return;
            
            const eventStart = new Date(event.start.dateTime);
            const eventEnd = new Date(event.end.dateTime);
            
            console.log('予定:', eventStart.toISOString(), '~', eventEnd.toISOString());
            
            // この予定と重複する30分枠をすべて埋める
            Object.keys(timeSlots).forEach(timeStr => {
                const [hour, minute] = timeStr.split(':').map(Number);
                const slotStart = new Date(targetDate);
                slotStart.setHours(hour, minute, 0, 0);
                
                const slotEnd = new Date(slotStart);
                slotEnd.setMinutes(slotEnd.getMinutes() + 30);
                
                // 重複チェック: スロットが既存予定と重なっているか
                if (slotStart < eventEnd && slotEnd > eventStart) {
                    timeSlots[timeStr] = false; // 予約済み
                    console.log(`${timeStr} は予約済み`);
                }
            });
        });
        
        console.log('最終的な空き枠:', timeSlots);
        
        return res.status(200).json({
            date: date,
            slots: timeSlots
        });
        
    } catch (error) {
        console.error('Available slots error:', error);
        return res.status(500).json({
            error: error.message || '空き枠の取得に失敗しました'
        });
    }
}
