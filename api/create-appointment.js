/**
 * Vercel Serverless Function - 面談予約作成API (詳細ログ版)
 * 
 * 機能:
 * - LINE userIDで求職者を検索
 * - 面談管理アプリにレコード作成（ルックアップで自動コピー）
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
        console.log('面談予約作成API開始');
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
        
        console.log('環境変数確認:');
        console.log('- KINTONE_DOMAIN:', KINTONE_DOMAIN);
        console.log('- JOBSEEKER_APP_ID:', JOBSEEKER_APP_ID);
        console.log('- APPOINTMENT_APP_ID:', APPOINTMENT_APP_ID);
        console.log('- KINTONE_API_TOKEN:', KINTONE_API_TOKEN ? '設定済み' : '未設定');
        console.log('- APPOINTMENT_API_TOKEN:', APPOINTMENT_API_TOKEN ? '設定済み' : '未設定');
        console.log('========================================');
        
        const kintoneBaseUrl = `https://${KINTONE_DOMAIN}/k/v1`;
        
        // ========================================
        // 1. LINE userIDで求職者を検索
        // ========================================
        console.log('ステップ1: 求職者を検索中...');
        
        const query = encodeURIComponent(`line_user_id = "${userId}"`);
        const searchUrl = `${kintoneBaseUrl}/records.json?app=${JOBSEEKER_APP_ID}&query=${query}`;
        
        console.log('検索URL:', searchUrl);
        
        const searchResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'X-Cybozu-API-Token': KINTONE_API_TOKEN
            }
        });
        
        console.log('検索レスポンスステータス:', searchResponse.status);
        
        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            console.error('検索エラー:', errorText);
            throw new Error(`求職者の検索に失敗: ${errorText}`);
        }
        
        const searchData = await searchResponse.json();
        console.log('検索結果:', searchData.records?.length || 0, '件');
        
        if (!searchData.records || searchData.records.length === 0) {
            throw new Error('求職者が見つかりませんでした');
        }
        
        const jobseeker = searchData.records[0];
        const jobseekerName = jobseeker.name.value;
        
        console.log('求職者を特定:');
        console.log('- 名前:', jobseekerName);
        console.log('- レコードID:', jobseeker.$id.value);
        console.log('========================================');
        
        // ========================================
        // 2. 面談管理アプリにレコード作成
        // ========================================
        console.log('ステップ2: 面談レコードを作成中...');
        
        // ルックアップフィールドにLINE userIDを設定
        // ルックアップの自動コピー機能で、名前やLINE表示名なども自動的にコピーされる
        const appointmentRecord = {
            date: { value: date },
            start: { value: startTime },
            end: { value: endTime },
            LINEuserID: { value: userId } // ルックアップのキーフィールド
        };
        
        console.log('作成するレコード:', JSON.stringify(appointmentRecord, null, 2));
        
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
        
        console.log('レコード作成レスポンスステータス:', createRecordResponse.status);
        
        if (!createRecordResponse.ok) {
            const errorText = await createRecordResponse.text();
            console.error('レコード作成エラー:', errorText);
            throw new Error(`面談レコードの作成に失敗: ${errorText}`);
        }
        
        const createRecordData = await createRecordResponse.json();
        console.log('面談レコード作成成功:');
        console.log('- レコードID:', createRecordData.id);
        console.log('- リビジョン:', createRecordData.revision);
        console.log('========================================');
        
        // ========================================
        // 3. Googleカレンダーに予定追加
        // ========================================
        console.log('ステップ3: Googleカレンダーに予定を追加中...');
        
        console.log('環境変数確認:');
        console.log('- GOOGLE_CALENDAR_CREDENTIALS:', process.env.GOOGLE_CALENDAR_CREDENTIALS ? '設定済み' : '未設定');
        console.log('- GOOGLE_CALENDAR_ID:', process.env.GOOGLE_CALENDAR_ID || '未設定');
        
        const credentials = JSON.parse(process.env.GOOGLE_CALENDAR_CREDENTIALS);
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        
        console.log('認証情報:');
        console.log('- project_id:', credentials.project_id);
        console.log('- client_email:', credentials.client_email);
        console.log('- calendar_id:', calendarId);
        console.log('========================================');
        
        console.log('Google認証を初期化中...');
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        console.log('Google認証初期化成功');
        
        console.log('Calendar APIクライアントを作成中...');
        const calendar = google.calendar({ version: 'v3', auth });
        console.log('Calendar APIクライアント作成成功');
        
        // 日時を作成
        const startDateTime = new Date(`${date}T${startTime}:00+09:00`);
        const endDateTime = new Date(`${date}T${endTime}:00+09:00`);
        
        console.log('予定の詳細:');
        console.log('- タイトル:', `面談: ${jobseekerName}`);
        console.log('- 開始時刻:', startDateTime.toISOString());
        console.log('- 終了時刻:', endDateTime.toISOString());
        console.log('========================================');
        
        const event = {
            summary: `面談: ${jobseekerName}`,
            description: `求職者: ${jobseekerName}\nLINE userID: ${userId}\nkintone面談ID: ${createRecordData.id}`,
            start: {
                dateTime: startDateTime.toISOString(),
                timeZone: 'Asia/Tokyo',
            },
            end: {
                dateTime: endDateTime.toISOString(),
                timeZone: 'Asia/Tokyo',
            },
        };
        
        console.log('カレンダーに予定を追加中...');
        console.log('リクエスト内容:', JSON.stringify(event, null, 2));
        
        try {
            const calendarResponse = await calendar.events.insert({
                calendarId: calendarId,
                resource: event,
            });
            
            console.log('Googleカレンダー予定作成成功:');
            console.log('- イベントID:', calendarResponse.data.id);
            console.log('- HTMLリンク:', calendarResponse.data.htmlLink);
            console.log('========================================');
            
            // ========================================
            // 成功レスポンス
            // ========================================
            console.log('すべての処理が完了しました');
            console.log('========================================');
            
            return res.status(200).json({
                success: true,
                kintoneRecordId: createRecordData.id,
                calendarEventId: calendarResponse.data.id,
                calendarEventLink: calendarResponse.data.htmlLink,
                jobseekerName: jobseekerName,
                message: '予約が完了しました'
            });
            
        } catch (calendarError) {
            console.error('========================================');
            console.error('カレンダー予定追加エラー:');
            console.error('- エラーメッセージ:', calendarError.message);
            console.error('- エラーコード:', calendarError.code);
            console.error('- エラー詳細:', JSON.stringify(calendarError, null, 2));
            console.error('========================================');
            
            // カレンダー追加に失敗してもkintoneレコードは作成済み
            console.warn('警告: Googleカレンダーへの追加は失敗しましたが、kintoneレコードは作成されています');
            
            throw new Error(`Googleカレンダーへの追加に失敗: ${calendarError.message}`);
        }
        
    } catch (error) {
        console.error('========================================');
        console.error('面談予約作成エラー:');
        console.error('- エラーメッセージ:', error.message);
        console.error('- エラースタック:', error.stack);
        console.error('========================================');
        
        return res.status(500).json({
            error: error.message || '予約中にエラーが発生しました',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
