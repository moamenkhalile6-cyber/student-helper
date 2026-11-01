export default async (req) => {

  if (req.method !== "POST") {

    return new Response("Method not allowed", { status: 405 });

  }

  try {

    const { question, action, image } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {

      return Response.json({ error: "مفتاح Gemini غير موجود في Netlify." }, { status: 500 });

    }

    if (!question?.trim() && !image) {

      return Response.json({ error: "اكتب سؤالك أو أرسل صورة." }, { status: 400 });

    }

    const parts = [{

      text: `المطلوب: ${action || "اشرح لي"}

سؤال الطالب: ${question || "اشرح محتوى الصورة"}

أجب باللغة العربية وبأسلوب واضح ومبسط.`

    }];

    if (image) {

      const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

      if (!match) {

        return Response.json({ error: "صيغة الصورة غير مدعومة." }, { status: 400 });

      }

      parts.push({

        inlineData: {

          mimeType: match[1],

          data: match[2]

        }

      });

    }

    const response = await fetch(

      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",

      {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

          "x-goog-api-key": apiKey

        },

        body: JSON.stringify({

          contents: [{ role: "user", parts }]

        })

      }

    );

    const data = await response.json();

    if (!response.ok) {

      return Response.json(

        { error: data.error?.message || "خطأ في Gemini." },

        { status: response.status }

      );

    }

    const answer = data.candidates?.[0]?.content?.parts

      ?.map(part => part.text || "")

      .join("\n");

    return Response.json({ answer: answer || "لم يصل جواب." });

  } catch (error) {

    return Response.json({ error: "حدث خطأ، حاول مرة ثانية." }, { status: 500 });

  }

};
