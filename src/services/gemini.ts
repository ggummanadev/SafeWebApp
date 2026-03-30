import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  // Check localStorage first for user-provided key
  const userKey = typeof window !== 'undefined' ? localStorage.getItem('user_gemini_api_key') : null;
  
  // In Vercel, environment variables are accessed via process.env
  // For client-side Vite apps, they might be prefixed with VITE_
  const apiKey = userKey || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. [설정] 메뉴에서 API Key를 입력하거나 Vercel 환경 변수 설정을 확인해주세요.");
  }
  
  return new GoogleGenAI({ apiKey });
};

export async function getBasicAnalysis(url: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `너는 웹 보안 및 구조 분석 전문가야. 입력되는 웹사이트 URL(${url})을 분석하여 다음 항목을 포함한 **[기초 분석 리포트]**를 작성해줘.

1. 제작 방식: 바이브코딩(Vercel, Replit, 노코드 툴 등) 특유의 패턴이 보이는지, 커스텀 개발인지 판별.
2. 인증 구조: 회원가입/로그인 폼 존재 여부 및 소셜 로그인 연동 여부.
3. 설치 형태: 단순 Web인지, PWA(설치형) 기능이 포함되어 있는지.
4. 데이터 민감도: input type="password", email, tel 등의 태그를 분석해 개인정보 요구 수준을 '낮음/중간/높음'으로 분류.
5. 서비스 성격: 정보제공/도구/광고/커뮤니티 중 가장 가까운 성격 정의. 도박, 성인, 불법 공유 사이트 여부도 반드시 확인.
6. OWASP Top 10 취약점: 해당 사이트의 공개된 구조에서 추정 가능한 OWASP Top 10 보안 취약점(인젝션, 인증 실패, 민감 데이터 노출 등)에 대한 간략한 위험도 평가.

**특별 주의**: 도박, 포르노, 불법영상공유, 불법웹툰 및 만화공유, 불법 이미지 및 생성형 페이크이미지(딥페이크 등) 공유사이트, 피싱 의심 사이트인지 면밀히 분석하여 리포트에 포함해줘.

결과는 반드시 사용자가 한눈에 볼 수 있게 표(Table) 형식으로 출력해줘.`,
    });
    
    if (!response.text) {
      throw new Error("응답 데이터가 없습니다.");
    }
    
    return response.text;
  } catch (error: any) {
    console.error("Gemini API Error (getBasicAnalysis):", error);
    throw error;
  }
}

export async function getDeepAnalysisGuide(url: string, basicReport: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `너는 'SafeWebApp'의 보안 가이드 AI야. 다음 기초 분석 결과를 바탕으로 '개인정보 요구'가 높거나 '출처 불분명'으로 판명된 사이트(${url})에 대해 정밀 분석 가이드를 작성해줘.

기초 분석 결과:
${basicReport}

수행 작업:
1. 도구 추천: Sucuri(악성코드), UpGuard(보안등급), VirusTotal(URL 검사) 중 가장 적합한 도구 2개를 매칭해줘.
2. 사용자 가이드: 선택된 도구의 링크를 제공하고, 해당 사이트에 접속했을 때 '어떤 버튼을 누르고 어떤 결과값(예: Clean, A-Grade 등)을 확인해야 하는지' 초보자 눈높이에서 3단계로 설명해줘.
3. 비용 정보: 해당 도구가 무료인지, 부분 유료인지 명시해줘.

**중요**: 만약 기초 분석 결과 해당 사이트가 안전하다고 판단되어 정밀 분석이 필요하지 않은 경우, 어떠한 가이드도 작성하지 말고 반드시 빈 문자열(내용 없음)을 반환해줘.`,
    });
    return response.text || "";
  } catch (error: any) {
    console.error("Gemini API Error (getDeepAnalysisGuide):", error);
    return "";
  }
}

export async function getAppSummary(url: string, basicReport: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `다음 웹사이트(${url})의 분석 리포트를 바탕으로 앱 이름, 카테고리, 서비스 내용(어떤 서비스인지), 보안 상태 요약, 그리고 '안전한 사이트' 여부(true/false), 그리고 해당 웹사이트의 주요 메뉴 목록(최대 6개)을 JSON 형식으로 추출해줘.
리포트:
${basicReport}

**중요**: 만약 해당 사이트가 도박, 포르노(성인), 불법영상공유, 불법웹툰 및 만화공유, 불법 이미지 및 생성형 페이크이미지(딥페이크 등) 공유사이트, 피싱 의심 사이트 중 하나라도 해당된다면 반드시 "isSafe"를 false로 설정하고, "securitySummary"에 해당 사유를 명확히 기재해줘.

JSON 형식:
{
  "name": "앱 이름",
  "category": "카테고리 (예: 금융, 쇼핑, 도구 등)",
  "serviceDescription": "어떤 서비스인지에 대한 간단한 설명 (한 문장)",
  "securitySummary": "보안 상태 요약 (한 문장)",
  "isSafe": true 또는 false (보안상 큰 위협이 없고 신뢰할 수 있는 경우 true),
  "mainMenus": ["메뉴1", "메뉴2", "메뉴3", ...]
}`,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Gemini API Error (getAppSummary):", error);
    return { name: url, category: "기타", serviceDescription: "분석된 웹 서비스", securitySummary: "분석 완료", isSafe: false, mainMenus: [] };
  }
}

export async function getOwaspAnalysis(basicReport: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `다음 보안 리포트를 바탕으로 OWASP Top 10 주요 보안 취약점 항목별로 위험도를 분석해줘.
리포트:
${basicReport}

JSON 형식:
{
  "owasp": [
    { "item": "항목 이름 (예: A01:2021-Broken Access Control)", "status": "safe | warning | danger", "desc": "취약점 설명 및 분석 결과" }
  ]
}
최소 5개 이상의 주요 항목을 포함해줘.`,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Gemini API Error (getOwaspAnalysis):", error);
    return { owasp: [] };
  }
}

export async function getStructuredAnalysis(basicReport: string) {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `다음 텍스트 기반 보안 리포트를 시각적으로 표현하기 좋게 4~5개의 핵심 포인트(아이콘 키워드 포함)로 요약해줘.
리포트:
${basicReport}

JSON 형식:
{
  "points": [
    { "icon": "Shield | Lock | User | Globe | Zap", "title": "제목", "desc": "짧은 설명" }
  ]
}`,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Gemini API Error (getStructuredAnalysis):", error);
    return { points: [] };
  }
}
