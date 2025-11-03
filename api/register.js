// Vercel Serverless Function - kintone Registration Proxy
// This function acts as a proxy to avoid CORS issues

export default async function handler(req, res) {
    // CORSヘッダーを設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // OPTIONSリクエスト（プリフライト）の処理
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // POSTリクエストのみ受け付ける
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // デバッグ用ログ
        console.log('Request body:', JSON.stringify(req.body));
        
        const { record } = req.body;
        
        // recordが存在しない場合のエラー
        if (!record) {
            console.error('No record in request body');
            return res.status(400).json({ 
                error: 'Missing or invalid input.',
                details: 'No record provided'
            });
        }
        
        // kintone設定
        const KINTONE_DOMAIN = '0ioyx3apbzda.cybozu.com';
        const KINTONE_APP_ID = '801';
        const KINTONE_API_TOKEN = 'ObIT9Awe9J1UPOvksMbOZp2i0LP3fImDvlFP4gpT';
        
        // kintone APIにリクエスト
        const kintoneUrl = `https://${KINTONE_DOMAIN}/k/v1/record.json?app=${KINTONE_APP_ID}`;
        
        console.log('Calling kintone API:', kintoneUrl);
        
        const kintoneResponse = await fetch(kintoneUrl, {
            method: 'POST',
            headers: {
                'X-Cybozu-API-Token': KINTONE_API_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                app: KINTONE_APP_ID,
                record: record
            })
        });
        
        console.log('kintone response status:', kintoneResponse.status);
        
        if (!kintoneResponse.ok) {
            const errorData = await kintoneResponse.json();
            console.error('kintone API error:', errorData);
            throw new Error(errorData.message || 'kintone API error');
        }
        
        const result = await kintoneResponse.json();
        
        // 成功レスポンスを返す
        return res.status(200).json({
            success: true,
            recordId: result.id,
            revision: result.revision
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}
