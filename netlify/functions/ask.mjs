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

    const content = [];

    content.push({
      type: "input_text",
      text: `المطلوب: ${action || "اشرح لي"}\nسؤال الطالب: ${question || "اشرح محتوى الصورة"}\nأجب باللغة العربية وبأسلوب واضح ومبسط.`
    });

    if (image) {
      content.push({
        type: "input_image",
        image_url: image
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [{ role: "user", content }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: data.error?.message || "حدث خطأ في الاتصال بالذكاء الاصطناعي." },
        { status: response.status }
      );
    }

    return Response.json({
      answer: data.output
        ?.flatMap(item => item.content || [])
        .filter(item => item.type === "output_text")
        .map(item => item.text)
        .join("\n") || "لم يصل جواب."
    });

  } catch (error) {
    return Response.json(
      { error: "حدث خطأ، حاول مرة ثانية." },
      { status: 500 }
    );
  }
};
