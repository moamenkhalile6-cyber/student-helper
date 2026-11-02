
export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { question, action, image } = await req.json();

    if (!question?.trim() && !image) {
      return Response.json(
        { error: "اكتب سؤالك أو أرسل صورة." },
        { status: 400 }
      );
    }

    const prompt = `المطلوب: ${action || "اشرح لي"}
سؤال الطالب: ${question || "اشرح محتوى الصورة"}

أجب باللغة العربية وبأسلوب واضح ومبسط.
اشرح الخطوات بالتفصيل عند الحاجة.`;

    let imageMime = "";
    let imageData = "";

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

      imageMime = match[1];
      imageData = match[2];
    }

    let lastError = "الخدمة غير متاحة حالياً.";

    // المحرك الأول: Gemini
    const geminiKey = (process.env.GEMINI_API_KEY || "").trim();

    if (geminiKey) {
      try {
        const parts = [{ text: prompt }];

        if (imageData) {
          parts.push({
            inlineData: {
              mimeType: imageMime,
              data: imageData
            }
          });
        }

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts }]
            })
          }
        );

        const data = await response.json();

        if (response.ok) {
          const answer = data.candidates?.[0]?.content?.parts
            ?.map(p => p.text || "")
            .join("\n");

          if (answer) {
            return Response.json({
              answer,
              provider: "gemini"
            });
          }
        }

        lastError =
          data.error?.message || "تعذر الحصول على جواب من Gemini.";

      } catch (error) {
        lastError = error.message;
      }
    }

    // المحرك الاحتياطي: OpenAI
    const openaiKey = (process.env.OPENAI_API_KEY || "").trim();

    if (openaiKey) {
      try {
        const content = [
          {
            type: "input_text",
            text: prompt
          }
        ];

        if (image) {
          content.push({
            type: "input_image",
            image_url: image
          });
        }

        const response = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
              model: "gpt-4.1-mini",
              input: [
                {
                  role: "user",
                  content
                }
              ]
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          return Response.json(
            {
              error: data.error?.message ||
                "تعذر تشغيل المحرك الاحتياطي."
            },
            { status: 502 }
          );
        }

        const answer = data.output_text ||
          data.output?.flatMap(item =>
            item.content?.map(part =>
              part.text || ""
            ) || []
          ).join("\n");

        if (answer) {
          return Response.json({
            answer,
            provider: "openai"
          });
        }

        throw new Error("لم يصل جواب من OpenAI.");

      } catch (error) {
        lastError = error.message;
      }
    }

    return Response.json(
      {
        error: "تعذر الحصول على إجابة حالياً. " + lastError
      },
      { status: 503 }
    );

  } catch (error) {
    return Response.json(
      {
        error: error.message || "حدث خطأ غير معروف."
      },
      { status: 500 }
    );
  }
};
