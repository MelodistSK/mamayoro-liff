// Vercel Serverless Function - kintone Registration Proxy
// 求職者をkintoneに登録するAPI

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

    console.log('========================================');
    console.log('Registration API called');
    console.log('========================================');

    try {
        const { record } = req.body;

        if (!record) {
            console.log('Error: Missing record data');
            return res.status(400).json({ error: 'Missing record data' });
        }

        // kintone設定
        const KINTONE_DOMAIN = '0ioyx3apbzda.cybozu.com';
        const KINTONE_APP_ID = '801';
        const KINTONE_API_TOKEN = 'ObIT9Awe9J1UPOvksMbOZp2i0LP3fImDvlFP4gpT';

        console.log('Step 1: Fetching latest record for ID generation...');

        // 最新の求職者IDを取得
        const getRecordsUrl = `https://${KINTONE_DOMAIN}/k/v1/records.json?app=${KINTONE_APP_ID}&query=order%20by%20%24id%20desc%20limit%201`;
        
        const getResponse = await fetch(getRecordsUrl, {
            method: 'GET',
            headers: {
                'X-Cybozu-API-Token': KINTONE_API_TOKEN
            }
        });

        let nextId = 1;
        if (getResponse.ok) {
            const getData = await getResponse.json();
            if (getData.records && getData.records.length > 0) {
                const lastId = getData.records[0].jobseeker_id?.value;
                if (lastId) {
                    const numPart = parseInt(lastId.replace('JS-', ''), 10);
                    nextId = numPart + 1;
                }
            }
        }

        // 求職者IDを生成（JS-0000001形式）
        const jobseekerId = `JS-${String(nextId).padStart(7, '0')}`;
        console.log('Step 2: Generated jobseeker_id:', jobseekerId);

        // レコードに求職者IDを追加
        record.jobseeker_id = { value: jobseekerId };

        console.log('Step 3: Creating record in kintone...');

        // kintone APIにレコード登録
        const createUrl = `https://${KINTONE_DOMAIN}/k/v1/record.json`;

        const createResponse = await fetch(createUrl, {
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

        if (!createResponse.ok) {
            const errorData = await createResponse.json();
            console.log('kintone API Error:', JSON.stringify(errorData));
            throw new Error(errorData.message || 'kintone API error');
        }

        const result = await createResponse.json();
        console.log('Step 4: Record created successfully!');
        console.log('Record ID:', result.id);
        console.log('Jobseeker ID:', jobseekerId);
        console.log('========================================');

        // 成功レスポンスを返す
        return res.status(200).json({
            success: true,
            recordId: result.id,
            revision: result.revision,
            jobseekerId: jobseekerId
        });

    } catch (error) {
        console.log('========================================');
        console.log('Registration Error:', error.message);
        console.log('========================================');
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}
