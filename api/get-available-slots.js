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
        
        console.log('========================================');
        console.log('空き枠取得API開始');
        console.log('- 日付:', date);
        console.log('========================================');
        
        if (!date) {
            console.error('エラー: 日付が指定されていません');
            return res.status(400).json({ error: '日付が指定されていません' });
        }
        
        // 環境変数から認証情報を取得
        console.log('環境変数チェック中...');
        
        if (!process.env.GOOGLE_CALENDAR_CREDENTIALS) {
            console.error('エラー: GOOGLE_CALENDAR_CREDENTIALS が設定されていません');
            return res.status(500).json({ error: 'カレンダー認証情報が設定されていません' });
        }
        
        if (!process.env.GOOGLE_CALENDAR_ID) {
            console.error('エラー: GOOGLE_CALENDAR_ID が設定されていません');
            return res.status(500).json({ error: 'カレンダーIDが設定されていません' });
        }
        
        let credentials;
        try {
            credentials = JSON.parse(process.env.GOOGLE_CALENDAR_CREDENTIALS);
            console.log('認証情報のパース成功');
            console.log('- project_id:', credentials.project_id);
            console.log('- client_email:', credentials.client_email);
        } catch (parseError) {
            console.error('エラー: 認証情報のパースに失敗:', parseError);
            return res.status(500).json({ error: '認証情報の形式が正しくありません' });
        }
        
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        
        console.log('環境変数確認:');
        console.log('- calendar_id:', calendarId);
        console.log('========================================');
        
        // Google Calendar API認証
        console.log('Google認証を初期化中...');
        let auth;
        try {
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/calendar'],
            });
            console.log('Google認証初期化成功');
        } catch (authError) {
            console.error('Google認証エラー:', authError);
            return res.status(500).json({ error: 'カレンダー認証に失敗しました' });
        }
        
        const calendar = google.calendar({ version: 'v3', auth });
        
        // ⭐ 修正: RFC3339形式（タイムゾーン情報を含む）
        const startOfDay = `${date}T00:00:00+09:00`;
        const endOfDay = `${date}T23:59:59+09:00`;
        
        console.log('取得期間:');
        console.log('- 開始:', startOfDay);
        console.log('- 終了:', endOfDay);
        console.log('========================================');
        
        // カレンダーから予定を取得
        console.log('カレンダーの予定を取得中...');
        let response;
        try {
            response = await calendar.events.list({
                calendarId: calendarId,
                timeMin: startOfDay,
                timeMax: endOfDay,
                singleEvents: true,
                orderBy: 'startTime',
            });
            console.log('カレンダー取得成功');
        } catch (calendarError) {
            console.error('カレンダー取得エラー:', calendarError);
            console.error('エラーコード:', calendarError.code);
            console.error('エラーメッセージ:', calendarError.message);
            console.error('エラー詳細:', JSON.stringify(calendarError.errors, null, 2));
            return res.status(500).json({ 
                error: 'カレンダーの取得に失敗しました',
                details: calendarError.message 
            });
        }
        
        const events = response.data.items || [];
        console.log('既存の予定:', events.length, '件');
        
        // 既存の予定をログ出力
        if (events.length > 0) {
            events.forEach((event, index) => {
                console.log(`予定 ${index + 1}:`);
                console.log('- タイトル:', event.summary);
                console.log('- 開始:', event.start.dateTime || event.start.date);
                console.log('- 終了:', event.end.dateTime || event.end.date);
            });
        } else {
            console.log('この日には予定がありません');
        }
        console.log('========================================');
        
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
        console.log('========================================');
        
        // ⭐ 既存の予定と重複する時間枠を除外
        events.forEach(event => {
            if (!event.start || !event.start.dateTime) {
                console.log('⚠️ dateTimeがない予定をスキップ:', event.summary);
                return;
            }
            
            const eventStartStr = event.start.dateTime;
            const eventEndStr = event.end.dateTime;
            
            // 時刻部分を抽出 (HH:MM)
            const eventStartTime = eventStartStr.substring(11, 16);
            const eventEndTime = eventEndStr.substring(11, 16);
            
            console.log('予定の時間帯:');
            console.log('- 予定:', event.summary);
            console.log('- 開始時刻:', eventStartTime);
            console.log('- 終了時刻:', eventEndTime);
            
            // この予定と重複する30分枠をすべて埋める
            Object.keys(timeSlots).forEach(timeStr => {
                const slotStart = timeStr;
                
                // 30分後を計算
                const [hour, minute] = timeStr.split(':').map(Number);
                const endHour = minute === 30 ? hour + 1 : hour;
                const endMinute = minute === 30 ? 0 : 30;
                const slotEnd = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
                
                // 重複チェック
                if (slotStart < eventEndTime && slotEnd > eventStartTime) {
                    console.log(`  ✗ ${timeStr} は予約済み（予定と重複）`);
                    timeSlots[timeStr] = false;
                }
            });
            
            console.log('---');
        });
        
        console.log('========================================');
        console.log('最終的な空き枠:');
        Object.entries(timeSlots).forEach(([time, available]) => {
            console.log(`- ${time}: ${available ? '空き' : '予約済み'}`);
        });
        console.log('========================================');
        console.log('空き枠取得API完了');
        console.log('========================================');
        
        return res.status(200).json({
            success: true,
            date: date,
            slots: timeSlots
        });
        
    } catch (error) {
        console.error('========================================');
        console.error('空き枠取得エラー:');
        console.error('- エラーメッセージ:', error.message);
        console.error('- エラースタック:', error.stack);
        console.error('========================================');
        
        return res.status(500).json({
            error: error.message || '空き枠の取得に失敗しました',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
