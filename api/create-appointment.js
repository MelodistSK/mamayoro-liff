/**
 * Vercel Serverless Function - 面談予約作成API
 * 
 * 機能:
 * - LINE userIDで求職者を検索
 * - 面談管理アプリにレコード作成
 * - Googleカレンダーに予定追加
 */

import { google } from 'googleapis';

export default async function handler(req, res) {
    // CORSヘッダー設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { userId, date, startTime, endTime } = req.body;
        
        console.log('========================================');
        console.log('予約リクエスト:');
        console.log('- userId:', userId);
        console.log('- date:', date);
        console.log('- startTime:', startTime);
        console.log('- endTime:', endTime);
        console.log('========================================');
        
        if (!userId || !date || !startTime || !endTime) {
            throw new Error('必要な情報が不足しています');
        }
        
        // kintone認証情報
        const KINTONE_DOMAIN = process.env.KINTONE_DOMAIN;
        const JOBSEEKER_APP_ID = process.env.KINTONE_APP_ID; // 求職者管理アプリ(801)
        const APPOINTMENT_APP_ID = '805'; // 面談管理アプリ
        const KINTONE_API_TOKEN = process.env.KINTONE_API_TOKEN;
        const APPOINTMENT_API_TOKEN = 'nwBHy23E4z1mL13ag7jn6cNR4oLbC7mTm2I6hRLd'; // 面談管理アプリのAPIトークン
        
        const kintoneBaseUrl = `https://${KINTONE_DOMAIN}/k/v1`;
        
        // ========================================
        // 1. LINE userIDで求職者を検索
        // ========================================
        console.log('求職者を検索中...');
        
        const query = encodeURIComponent(`line_user_id = "${userId}"`);
        const searchUrl = `${kintoneBaseUrl}/records.json?app=${JOBSEEKER_APP_ID}&query=${query}`;
        
        const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'X-Cybozu-API-Token': KINTONE_API_TOKEN
            }
        });
        
        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            throw new Error(`求職者の検索に失敗: ${errorText}`);
        }
        
        const searchData = await searchResponse.json();
        
        if (!searchData.records || searchData.records.length === 0) {
            throw new Error('求職者が見つかりませんでした');
        }
        
        const jobseeker = searchData.records[0];
        const jobseekerName = jobseeker.name.value;
        
        console.log('求職者を特定:', jobseekerName);
        
        // ========================================
        // 2. 面談管理アプリにレコード作成
        // ========================================
        console.log('面談レコードを作成中...');
        
        const appointmentRecord = {
            date: { value: date },
            start: { value: startTime },
            end: { value: endTime },
            lookup_line_user_id: { value: userId } // ルックアップのキーフィールド
        };
        
        const createRecordResponse = await fetch(`${kintoneBaseUrl}/record.json`, {
            method: 'POST',
            headers: {
                'X-Cybozu-API-Token': APPOINTMENT_API_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                app: APPOINTMENT_APP_ID,
                record: appointmentRecord
            })
        });
        
        if (!createRecordResponse.ok) {
            const errorText = await createRecordResponse.text();
            throw new Error(`面談レコードの作成に失敗: ${errorText}`);
        }
        
        const createRecordData = await createRecordResponse.json();
        console.log('面談レコード作成成功:', createRecordData.id);
        
        // ========================================
        // 3. Googleカレンダーに予定追加
        // ========================================
        console.log('Googleカレンダーに予定を追加中...');
        
        const credentials = JSON.parse(process.env.GOOGLE_CALENDAR_CREDENTIALS);
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        
        const calendar = google.calendar({ version: 'v3', auth });
        
        // 日時を作成
        const startDateTime = new Date(`${date}T${startTime}:00+09:00`);
        const endDateTime = new Date(`${date}T${endTime}:00+09:00`);
        
        const event = {
            summary: `面談: ${jobseekerName}`,
            description: `求職者: ${jobseekerName}\nkintone面談ID: ${createRecordData.id}`,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'Asia/Tokyo',
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'Asia/Tokyo',
            },
        };
        
        const calendarResponse = await calendar.events.insert({
            calendarId: calendarId,
            resource: event,
        });
        
        console.log('Googleカレンダー予定作成成功:', calendarResponse.data.id);
        
        // ========================================
        // 成功レスポンス
        // ========================================
        return res.status(200).json({
            success: true,
            kintoneRecordId: createRecordData.id,
            calendarEventId: calendarResponse.data.id,
            jobseekerName: jobseekerName,
            message: '予約が完了しました'
        });
        
    } catch (error) {
        console.error('========================================');
        console.error('Appointment creation error:', error);
        console.error('Error message:', error.message);
        console.error('========================================');
        return res.status(500).json({
            error: error.message || '予約中にエラーが発生しました'
        });
    }
}
