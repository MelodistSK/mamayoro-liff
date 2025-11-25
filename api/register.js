/**
 * Vercel Serverless Function - 求職者登録API
 * 
 * 機能:
 * - kintoneの求職者管理アプリにレコードを作成
 * - 求職者IDを自動生成
 */

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
        const { record } = req.body;
        
        // kintone認証情報
        const KINTONE_DOMAIN = process.env.KINTONE_DOMAIN;
        const KINTONE_APP_ID = process.env.KINTONE_APP_ID;
        const KINTONE_API_TOKEN = process.env.KINTONE_API_TOKEN;
        
        console.log('環境変数確認:');
        console.log('- KINTONE_DOMAIN:', KINTONE_DOMAIN);
        console.log('- KINTONE_APP_ID:', KINTONE_APP_ID);
        console.log('- KINTONE_API_TOKEN:', KINTONE_API_TOKEN ? '設定済み' : '未設定');
        
        if (!KINTONE_DOMAIN || !KINTONE_APP_ID || !KINTONE_API_TOKEN) {
            throw new Error('環境変数が正しく設定されていません');
        }
        
        // ========================================
        // 1. 最新の求職者IDを取得して新しいIDを生成
        // ========================================
        const query = 'order by jobseeker_id desc limit 1';
        const getUrl = `https://${KINTONE_DOMAIN}/k/v1/records.json?app=${KINTONE_APP_ID}&query=${encodeURIComponent(query)}`;
        
        console.log('最新の求職者IDを取得中...');
        console.log('URL:', getUrl);
        
        const getResponse = await fetch(getUrl, {
            method: 'GET',
            headers: {
                'X-Cybozu-API-Token': KINTONE_API_TOKEN
            }
        });
        
        if (!getResponse.ok) {
            const errorText = await getResponse.text();
            console.error('最新ID取得エラー:', errorText);
            throw new Error(`最新IDの取得に失敗: ${errorText}`);
        }
        
        const getData = await getResponse.json();
        console.log('取得したレコード数:', getData.records?.length || 0);
        
        // 新しい求職者IDを生成
        let newJobseekerId;
        if (getData.records && getData.records.length > 0) {
            const latestId = getData.records[0].jobseeker_id.value;
            console.log('最新の求職者ID:', latestId);
            
            // "JS-0000001" から数値部分を抽出
            const match = latestId.match(/JS-(\d+)/);
            if (match) {
                const nextNumber = parseInt(match[1]) + 1;
                newJobseekerId = `JS-${String(nextNumber).padStart(7, '0')}`;
            } else {
                newJobseekerId = 'JS-0000001';
            }
        } else {
            newJobseekerId = 'JS-0000001';
        }
        
        console.log('生成した新しい求職者ID:', newJobseekerId);
        
        // ========================================
        // 2. レコードに求職者IDを追加
        // ========================================
        record.jobseeker_id = { value: newJobseekerId };
        
        console.log('登録するレコード:', JSON.stringify(record, null, 2));
        
        // ========================================
        // 3. kintoneにレコードを作成
        // ========================================
        const postUrl = `https://${KINTONE_DOMAIN}/k/v1/record.json`;
        
        const postResponse = await fetch(postUrl, {
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
        
        if (!postResponse.ok) {
            const errorText = await postResponse.text();
            console.error('レコード作成エラー:', errorText);
            throw new Error(`レコードの作成に失敗: ${errorText}`);
        }
        
        const result = await postResponse.json();
        console.log('レコード作成成功:', result);
        
        return res.status(200).json({
            success: true,
            id: result.id,
            jobseekerId: newJobseekerId,
            revision: result.revision
        });
        
    } catch (error) {
        console.error('登録エラー:', error);
        return res.status(500).json({
            error: error.message || '登録に失敗しました'
        });
    }
}
