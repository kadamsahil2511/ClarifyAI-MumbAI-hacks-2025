import React, { useState } from "react";

const GeminiImageChecker = () => {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"; // replace with your key
  const MODEL = "models/text-bison-001"; // Gemini text model for now (we can use image + text combo if supported)

  const handleFileChange = (e) => {
    setImage(e.target.files[0]);
    setResult("");
  };

  const handleSubmit = async () => {
    if (!image) {
      alert("Please upload an image first!");
      return;
    }

    setLoading(true);

    try {
      // Convert image to Base64
      const reader = new FileReader();
      reader.readAsDataURL(image);
      reader.onloadend = async () => {
        const base64Image = reader.result.split(",")[1];

        // Send request to Gemini API
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateMessage?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: {
                text: `Analyze this image and tell me if the information shown in it is true or false. Respond concisely and clearly.\n\nImage (base64): ${base64Image}`,
              },
              temperature: 0,
              maxOutputTokens: 500,
            }),
          }
        );

        const data = await response.json();
        setResult(data?.candidates?.[0]?.content?.[0]?.text || "No result found.");
        setLoading(false);
      };
    } catch (error) {
      console.error("Error:", error);
      setResult("Something went wrong.");
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h2>Gemini Image Fact Checker</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={handleSubmit} style={{ marginLeft: "1rem" }}>
        {loading ? "Checking..." : "Check Image"}
      </button>

      {image && (
        <div style={{ marginTop: "1rem" }}>
          <img
            src={URL.createObjectURL(image)}
            alt="Uploaded"
            style={{ maxWidth: "300px", maxHeight: "300px" }}
          />
        </div>
      )}

      {result && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "#f0f0f0" }}>
          <strong>Result:</strong>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
};

export default GeminiImageChecker;