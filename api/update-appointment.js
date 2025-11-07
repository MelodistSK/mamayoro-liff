/**
 * Vercel Serverless Function - 面談予定更新API
 * 
 * 機能:
 * - Googleカレンダーの予定を更新
 */

import { google } from 'googleapis';

export default async function handler(req, res) {
    // CORSヘッダー設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { eventId, date, startTime, endTime, summary, description } = req.body;
        
        console.log('========================================');
        console.log('カレンダー予定更新API開始');
        console.log('========================================');
        console.log('更新リクエスト:');
        console.log('- eventId:', eventId);
        console.log('- date:', date);
        console.log('- startTime:', startTime);
        console.log('- endTime:', endTime);
        console.log('- summary:', summary);
        console.log('========================================');
        
        if (!eventId || !date || !startTime || !endTime) {
            throw new Error('必要な情報が不足しています');
        }
        
        // 環境変数から認証情報を取得
        const credentials = JSON.parse(process.env.GOOGLE_CALENDAR_CREDENTIALS);
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        
        console.log('環境変数確認:');
        console.log('- calendar_id:', calendarId);
        console.log('========================================');
        
        // Google Calendar API認証
        console.log('Google認証を初期化中...');
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        console.log('Google認証初期化成功');
        
        const calendar = google.calendar({ version: 'v3', auth });
        
        // 更新する予定の内容
        const event = {
            summary: summary,
            description: description,
            start: {
                dateTime: `${date}T${startTime}:00+09:00`,
                timeZone: 'Asia/Tokyo',
            },
            end: {
                dateTime: `${date}T${endTime}:00+09:00`,
                timeZone: 'Asia/Tokyo',
            },
        };
        
        console.log('カレンダー予定を更新中...');
        console.log('更新内容:', JSON.stringify(event, null, 2));
        
        try {
            const response = await calendar.events.update({
                calendarId: calendarId,
                eventId: eventId,
                resource: event,
            });
            
            console.log('カレンダー予定更新成功:');
            console.log('- イベントID:', response.data.id);
            console.log('- HTMLリンク:', response.data.htmlLink);
            console.log('========================================');
            
            return res.status(200).json({
                success: true,
                eventId: response.data.id,
                htmlLink: response.data.htmlLink,
                message: 'カレンダー予定を更新しました'
            });
            
        } catch (calendarError) {
            console.error('カレンダー更新エラー:', calendarError);
            console.error('エラーコード:', calendarError.code);
            console.error('エラーメッセージ:', calendarError.message);
            throw new Error(`Googleカレンダーの更新に失敗: ${calendarError.message}`);
        }
        
    } catch (error) {
        console.error('========================================');
        console.error('カレンダー予定更新エラー:');
        console.error('- エラーメッセージ:', error.message);
        console.error('- エラースタック:', error.stack);
        console.error('========================================');
        
        return res.status(500).json({
            error: error.message || 'カレンダー予定の更新に失敗しました',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
