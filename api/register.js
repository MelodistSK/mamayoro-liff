/**
 * Vercel Serverless Function - kintone求職者登録API
 * 
 * 機能:
 * - 求職者IDを自動生成してkintoneに登録
 * - フォーマット: JS-0000001(7桁ゼロ埋め)
 */

export default async function handler(req, res) {
    // CORSヘッダー設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // OPTIONSリクエスト対応
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { record } = req.body;
        
        // kintone認証情報
        const KINTONE_DOMAIN = process.env.KINTONE_DOMAIN;
        const KINTONE_APP_ID = process.env.KINTONE_APP_ID;
        const KINTONE_API_TOKEN = process.env.KINTONE_API_TOKEN;
        
        console.log('========================================');
        console.log('環境変数チェック:');
        console.log('- KINTONE_DOMAIN:', KINTONE_DOMAIN || '未設定');
        console.log('- KINTONE_APP_ID:', KINTONE_APP_ID || '未設定');
        console.log('- KINTONE_API_TOKEN:', KINTONE_API_TOKEN ? '設定済み' : '未設定');
        console.log('========================================');
        
        if (!KINTONE_DOMAIN || !KINTONE_APP_ID || !KINTONE_API_TOKEN) {
            throw new Error('環境変数が設定されていません');
        }
        
        const kintoneBaseUrl = `https://${KINTONE_DOMAIN}/k/v1`;
        const queryUrl = `${kintoneBaseUrl}/records.json?app=${KINTONE_APP_ID}&query=order by $id desc limit 1`;
        
        console.log('リクエストURL:', queryUrl);
        
        // ========================================
        // 1. 最新のレコード番号を取得
        // ========================================
        const getRecordsResponse = await fetch(queryUrl, {
            method: 'GET',
            headers: {
                'X-Cybozu-API-Token': KINTONE_API_TOKEN,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('レスポンスステータス:', getRecordsResponse.status);
        
        if (!getRecordsResponse.ok) {
            const errorText = await getRecordsResponse.text();
            console.error('kintoneエラー:', errorText);
            throw new Error(`最新レコード取得失敗: ${errorText}`);
        }
        
        const getRecordsData = await getRecordsResponse.json();
        console.log('取得したレコード数:', getRecordsData.records?.length || 0);
        
        // ========================================
        // 2. 求職者IDを生成
        // ========================================
        let nextRecordNumber = 1;
        
        if (getRecordsData.records && getRecordsData.records.length > 0) {
            const latestRecord = getRecordsData.records[0];
            const latestRecordId = parseInt(latestRecord.$id.value);
            nextRecordNumber = latestRecordId + 1;
            console.log('最新レコードID:', latestRecordId);
        }
        
        const jobseekerId = 'JS-' + String(nextRecordNumber).padStart(7, '0');
        console.log('生成された求職者ID:', jobseekerId);
        
        // ========================================
        // 3. 求職者IDを追加してレコード作成
        // ========================================
        const recordWithId = {
            ...record,
            jobseeker_id: { value: jobseekerId }
        };
        
        const createRecordResponse = await fetch(
            `${kintoneBaseUrl}/record.json`,
            {
                method: 'POST',
                headers: {
                    'X-Cybozu-API-Token': KINTONE_API_TOKEN,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    app: KINTONE_APP_ID,
                    record: recordWithId
                })
            }
        );
        
        if (!createRecordResponse.ok) {
            const errorText = await createRecordResponse.text();
            console.error('レコード作成エラー:', errorText);
            throw new Error(`レコード作成失敗: ${errorText}`);
        }
        
        const createRecordData = await createRecordResponse.json();
        console.log('レコード作成成功! ID:', createRecordData.id);
        
        return res.status(200).json({
            success: true,
            id: createRecordData.id,
            jobseeker_id: jobseekerId,
            message: '登録が完了しました'
        });
        
    } catch (error) {
        console.error('========================================');
        console.error('Registration error:', error);
        console.error('Error message:', error.message);
        console.error('========================================');
        return res.status(500).json({
            error: error.message || '登録中にエラーが発生しました'
        });
    }
}
