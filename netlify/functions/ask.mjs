
export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { question, action, image } = await req.json();
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();

    if (!apiKey) {
      return Response.json(
        { error: "مفتاح Gemini غير موجود." },
        { status: 500 }
      );
    }

    if (!question?.trim() && !image) {
      return Response.json(
        { error: "اكتب سؤالك أو أرسل صورة." },
        { status: 400 }
      );
    }

    const parts = [{
      text: `المطلوب: ${action || "اشرح لي"}
سؤال الطالب: ${question || "اشرح محتوى الصورة"}
أجب باللغة العربية وبأسلوب واضح ومبسط.`
    }];

    if (image) {
      const match = image.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
      );

      if (!match) {
        return Response.json(
          { error: "صيغة الصورة غير مدعومة." },
          { status: 400 }
        );
      }

      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2]
        }
      });
    }

    const models = [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash"
    ];

    let lastError = "كل الموديلات مشغولة حاليًا.";

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
          lastError =
            data.error?.message || "خطأ في Gemini.";

          if ([429, 500, 502, 503, 504].includes(response.status)) {
            continue;
          }

          return Response.json(
            { error: lastError },
            { status: response.status }
          );
        }

        const answer = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("\n");

        if (answer) {
          return Response.json({ answer });
        }

        lastError = "لم يصل جواب من Gemini.";

      } catch (error) {
        lastError = error.message;
      }
    }

    return Response.json(
      {
        error: "حاولنا أكثر من موديل، لكن الخدمة مشغولة. حاول بعد قليل. " + lastError
      },
      { status: 503 }
    );

  } catch (error) {
    return Response.json(
      { error: error.message || "حدث خطأ غير معروف." },
      { status: 500 }
    );
  }
};
