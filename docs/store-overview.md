# Chrome Web Store Overview

## Store Summary

Export Udemy lecture transcripts, translate them your way or with your own OpenAI API key, and watch courses with customizable in-player subtitles.

## Store Overview (English)

Udemy Custom Script helps learners build their own subtitle workflow instead of being locked to a single translation service.

The extension exports the current Udemy lecture transcript together with structured metadata such as the course, section, lecture, language, and transcript update timestamp. You can then take that script to an external LLM or translation workflow, produce a translation in the style and quality you want, and import the completed script back into the extension. If you prefer, you can also connect your own OpenAI API key and run direct AI translation inside the extension.

Once a translated script is saved, the extension matches it to the current lecture and renders custom subtitles directly inside the Udemy player. Learners can switch between translation-only and bilingual display modes, change subtitle order, and customize font, spacing, background opacity, and padding for both the source line and the translated line independently.

Key features:
- Export the current lecture transcript with structured metadata
- Keep using a manual copy/import workflow with any external LLM or editing process
- Optionally translate the current lecture with your own OpenAI API key
- Import externally translated scripts in the extension's custom JSON-based format
- Match saved scripts to the correct Udemy course, section, and lecture
- Display custom subtitles directly inside the player during playback
- Customize subtitle layout and display preferences
- Configure optional LLM translation guidance for copy workflows

This extension is designed for user-controlled learning workflows. It does not force a specific translation provider such as Google Translate or DeepL. Instead, it supports flexible translation pipelines built around GPT, Gemini, or other tools chosen by the user.

This product is not affiliated with or endorsed by Udemy.

## 스토어 상세 설명 (Korean)

Udemy Custom Script는 Udemy 강의 자막을 단순히 추출하는 데서 끝나지 않고, 사용자가 직접 만든 번역 대본을 다시 강의 플레이어 안에서 실시간으로 표시할 수 있게 해주는 확장입니다.

현재 강의의 대본을 코스, 섹션, 강의, 언어, 업데이트 시각 등의 메타데이터와 함께 내보낸 뒤, 사용자는 그 스크립트를 GPT, Gemini 같은 외부 LLM이나 자신이 선호하는 번역 워크플로우에 넣어 원하는 스타일과 품질로 번역할 수 있습니다. 원한다면 자신의 OpenAI API 키를 연결해 확장 안에서 직접 AI 번역을 실행할 수도 있습니다. 이후 완성된 스크립트를 확장에 가져오거나 확장이 직접 저장하면, 현재 강의와 일치하는 대본을 찾아 강의 재생 중 플레이어 내부에 커스텀 자막으로 출력합니다.

주요 기능:
- 현재 강의 대본을 구조화된 메타데이터와 함께 내보내기
- 외부 LLM/수동 편집 기반의 복사-번역-가져오기 워크플로우 유지
- 사용자 OpenAI API 키 기반 직접 AI 번역 지원
- 외부에서 번역한 커스텀 스크립트 가져오기
- 코스/섹션/lecture 기준으로 저장된 대본 자동 매칭
- 재생 중 플레이어 내부에 커스텀 자막 표시
- 번역문만 보기, 원문+번역문 보기, 출력 순서 변경 지원
- 원문/번역문별 폰트, 배경, 여백, 간격 개별 커스터마이징
- LLM 번역 지침 포함 여부 및 지침 내용 설정 지원

이 확장은 특정 번역 서비스 사용을 강제하지 않습니다. Google Translate, DeepL 같은 정해진 도구 대신, 사용자가 직접 원하는 LLM과 프롬프트 전략을 선택해 강의 목적에 맞는 번역문을 만들 수 있도록 설계되었습니다.

이 제품은 Udemy와 제휴하거나 승인을 받은 제품이 아닙니다.

## Permission Notes

- `storage`: save extension settings, library indexes, and imported script metadata
- `tabs`: inspect the active Udemy tab and open the options page when requested
- `https://www.udemy.com/*`: read the current lecture page context and request lecture metadata
- `https://*.udemycdn.com/*`: fetch caption resources for the active lecture when Udemy serves transcripts from its CDN
- `https://api.openai.com/*`: send transcript chunks to OpenAI only when the user explicitly starts direct AI translation with their own API key

## Privacy Disclosure Draft

Suggested Chrome Web Store dashboard answers, assuming the current implementation keeps optional direct OpenAI translation and no custom backend:

- Personal data sold: No
- Personal data used for purposes unrelated to the item's core functionality: No
- Personal data used for creditworthiness or lending purposes: No
- Data collection: The extension does not send saved scripts to a custom backend service
- User activity: Only used locally to detect the active Udemy lecture and match saved scripts
- Website content: Accessed only on Udemy lecture pages to extract lecture metadata and transcript data needed for the extension's core functionality
- Third-party transfer: If the user explicitly starts direct AI translation, transcript content and related metadata needed for translation are sent to OpenAI using the user's own API key

Review this again before release if any additional provider, cloud sync, or backend integration is added.

## Screenshot Ideas

- Popup showing lecture detection and `Copy custom script`
- Popup showing `Translate with AI` and in-progress chunk status
- Options page showing subtitle customization controls
- Udemy player with bilingual custom subtitles enabled
- Library view with imported scripts matched by lecture
