/**
 * Aliyun Qwen-VL Service for SmartCare Pro
 */

export const parseMedicalRecord = async (inputImages, apiKey, model = "qwen-vl-max") => {
    // Use local proxy in Dev to bypass CORS. In Prod (App), use direct URL.
    const isDev = import.meta.env.DEV;
    const baseUrl = isDev ? '/api/dashscope' : 'https://dashscope.aliyuncs.com';
    const url = `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`;
    if (!apiKey) throw new Error("缺少 API Key");
    
    const prompt = `
你是一个专业的医疗数据结构化专家。这是一张用户脱敏后的医疗单据图片。
请分析图片内容，判断单据类型，并提取关键结构化信息。
请返回严格的 JSON 格式数据，不要包含 Markdown 格式。

请提取以下字段（如不存在对应信息则留空或返回 null）：

1. 通用信息：
   - type: 单据类型 (枚举值: "挂号单", "病历", "检验报告", "处方", "收据/缴费单", "其他")
   - date: 日期 (格式 YYYY-MM-DD)
   - hospital: 医院名称
   - department: 科室
   - doctor: 医生姓名

2. 业务详情（根据类型提取）：
   - diagnosis: 临床诊断、主诉或检查结论（如果是挂号单，请填写入座号/时段）
   - cost: 总金额 (数字类型，收据必填)
   - medications: 药品或收费项目列表 (数组)，包含:
     - name: 项目/药品名称
     - dosage: (处方特有) 用法用量/规格，如 "Po bid"
     - quantity: 数量
     - price: (收据特有) 单项金额/单价
   - inspection_headers: 检验检查单的表格表头列表 (数组，如 ["项目", "结果", "单位", "参考值", "提示"])，请尽量保持原单据表头
   - inspections: 检验/检查指标 (数组，数组内对象的键名必须与 inspection_headers 保持一致)

注意：
- 区分【处方】和【收据】：有"用法/频次"的是处方；全是"金额"的是收据。
- 如果是收据，请将项目填入 medications，并填写 price，dosage 留空。
- 处方和收据可能混在一起，请综合提取，优先保留用法信息。
    `.trim();

    // Normalize input to array
    const images = Array.isArray(inputImages) ? inputImages : [inputImages];

    // Construct content array with multiple images
    const userContent = images.map(img => {
        const base64 = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
        return { type: "image", image: base64 };
    });
    // Add text prompt at the end
    userContent.push({ type: "text", text: prompt });

    const body = {
        model: model,
        input: {
            messages: [
                {
                    role: "system",
                    content: [{ type: "text", text: "You are a helpful medical record assistant." }]
                },
                {
                    role: "user",
                    content: userContent
                }
            ]
        },
        parameters: {
            result_format: "message"
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        
        if (data.output && data.output.choices && data.output.choices[0].message) {
            // Extract text response
            const contentList = data.output.choices[0].message.content;
            // Usually content is a list, finding the text part
            const textPart = contentList.find(item => item.text);
            if (!textPart) throw new Error("No text response from AI");
            
            let rawJson = textPart.text;
            // Cleanup Markdown
            rawJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
            
            return JSON.parse(rawJson);
        } else {
            throw new Error("Invalid Response Structure");
        }

    } catch (error) {
        console.error("AI Parsing Failed:", error);
        throw error;
    }
};

/**
 * AI Health Assistant Q&A
 * @param {Array} records - List of medical records
 * @param {String} question - User's question
 * @param {String} apiKey - Dashscope API Key
 */
export const askHealthAssistant = async (records, question, apiKey) => {
    // 1. Prepare Context (Simplify records to save tokens)
    const context = records.map(r => {
        return `
- index: ${r.id}
- date: ${r.date}
- hospital: ${r.hospital || 'Unknown'}
- dept: ${r.department || 'Unknown'}
- type: ${r.type}
- diagnosis: ${r.diagnosis || 'None'}
- medications: ${(r.medications || []).map(m => m.name).join(', ')}
        `.trim();
    }).join('\n');

    const prompt = `
你是一个私人医疗健康助手。用户会基于由于所有的历史就诊记录向你提问。
请根据以下提供的【就诊记录数据库】回答用户的问题。

【就诊记录数据库】:
${context}

【用户问题】: ${question}

要求：
1. 仅根据提供的数据回答，不要编造信息。
2. 如果记录中找不到答案，请直接说“记录中没有相关信息”。
3. 回答要在中文，语气亲切专业。
4. 如果涉及时间，请按时间倒序梳理。
`.trim();

    // Use local proxy in Dev
    const isDev = import.meta.env.DEV;
    const baseUrl = isDev ? '/api/dashscope' : 'https://dashscope.aliyuncs.com';
    // Use text-generation model (e.g., qwen-turbo or qwen-plus)
    const url = `${baseUrl}/api/v1/services/aigc/text-generation/generation`;
    
    if (!apiKey) throw new Error("缺少 API Key");

    const body = {
        model: "qwen-turbo", // Cost-effective model for text logic
        input: {
            messages: [
                { role: "system", content: "You are a helpful medical assistant." },
                { role: "user", content: prompt }
            ]
        },
        parameters: {
            result_format: "message"
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`AI Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        if (data.output && data.output.choices && data.output.choices[0].message) {
             return data.output.choices[0].message.content;
        } else {
             throw new Error("Invalid AI Response");
        }
    } catch (error) {
        console.error("AI Q&A Failed:", error);
        throw error;
    }
};
