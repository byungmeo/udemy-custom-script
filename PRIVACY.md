# Privacy Policy

Last updated: 2026-03-12

## English

Udemy Custom Script is a Chrome extension that helps users export Udemy lecture transcripts, import their own translated subtitle scripts, and display those scripts during lecture playback.

### What data the extension accesses

The extension may access the following data on Udemy lecture pages opened by the user:

- Lecture metadata such as course title, section title, lecture title, lecture identifiers, transcript language, and transcript update information
- Transcript or caption content made available for the current lecture
- User-provided custom subtitle scripts imported into the extension
- Extension settings such as subtitle display preferences, UI language, and LLM guidance preferences
- If the user enables direct AI translation, an OpenAI API key stored locally by the user for that purpose

### How the data is used

This data is used only to provide the extension's core functionality:

- export the current lecture transcript in the extension's custom format
- match imported custom subtitle scripts to the correct Udemy lecture
- display saved subtitles in the Udemy player during playback
- save user preferences for subtitle display and copy behavior
- if the user explicitly starts direct AI translation, send the transcript content, related metadata context, and optional user guidance needed for that translation request to OpenAI using the user's own API key

### Data storage

The extension stores data locally in the user's browser:

- settings and script index metadata may be stored using Chrome storage
- user-provided OpenAI API keys may be stored in local extension storage in the current browser profile
- full imported script content may be stored in browser local storage mechanisms such as IndexedDB
- in-progress AI translation jobs and resumable translation session state may be stored locally while translation is running

The extension does not require a separate backend service for its current functionality.

### Data sharing

The extension does not sell user data.
The extension does not transfer user data to third parties for advertising, profiling, analytics, or unrelated purposes.

If the user explicitly starts direct AI translation, the extension sends the transcript content, related translation metadata, and optional guidance needed for that request to OpenAI using the user's own API key. That transfer is performed only to fulfill the user-requested translation action.

If the user chooses to copy exported content and manually paste it into an external AI or translation service, that action is performed by the user outside the extension. The privacy practices of those third-party services are governed by their own policies.

### Remote code

The extension does not use remote code.

### Your choices

Users can:

- remove saved scripts from the extension library
- clear imported text before saving
- uninstall the extension to stop all future access

### Contact

For privacy questions, please use the publisher contact information provided in the Chrome Web Store listing for this extension.

## 한국어

Udemy Custom Script는 Udemy 강의 대본을 내보내고, 사용자가 직접 준비한 번역 자막 스크립트를 가져오며, 이를 강의 재생 중 표시할 수 있게 해주는 Chrome 확장입니다.

### 확장이 접근할 수 있는 데이터

확장은 사용자가 연 Udemy 강의 페이지에서 다음 정보를 접근할 수 있습니다.

- 코스 제목, 섹션 제목, 강의 제목, 강의 식별자, 대본 언어, 대본 업데이트 정보 등의 강의 메타데이터
- 현재 강의에 제공되는 대본 또는 자막 내용
- 사용자가 확장에 가져온 커스텀 자막 스크립트
- 자막 표시 설정, UI 언어, LLM 지침 설정과 같은 확장 설정값
- 사용자가 직접 AI 번역을 위해 설정한 경우, 해당 목적의 OpenAI API 키

### 데이터 사용 목적

이 데이터는 확장의 핵심 기능을 제공하는 데에만 사용됩니다.

- 현재 강의 대본을 확장 전용 포맷으로 내보내기
- 가져온 커스텀 자막 스크립트를 올바른 Udemy 강의와 매칭하기
- 저장된 자막을 Udemy 플레이어에서 재생 중 표시하기
- 자막 표시 및 복사 동작에 대한 사용자 설정 저장하기
- 사용자가 직접 AI 번역을 시작한 경우, 번역에 필요한 대본 내용, 관련 메타데이터 문맥, 선택적 지침을 사용자의 OpenAI API 키로 OpenAI에 전송하기

### 데이터 저장

확장은 데이터를 사용자의 브라우저에 로컬로 저장합니다.

- 설정값과 스크립트 인덱스 메타데이터는 Chrome storage에 저장될 수 있습니다
- 사용자가 입력한 OpenAI API 키는 현재 브라우저 프로필의 로컬 확장 저장소에 저장될 수 있습니다
- 전체 스크립트 본문은 IndexedDB와 같은 브라우저 로컬 저장소에 저장될 수 있습니다
- AI 번역 진행 중에는 번역 작업 상태와 재개용 세션 정보가 로컬에 저장될 수 있습니다

현재 기능 기준으로 별도의 백엔드 서버는 필요하지 않습니다.

### 데이터 공유

확장은 사용자 데이터를 판매하지 않습니다.
또한 광고, 프로파일링, 분석, 기타 전용 목적과 무관한 용도로 사용자 데이터를 제3자에게 전송하지 않습니다.

다만 사용자가 직접 AI 번역을 시작한 경우, 해당 요청을 처리하기 위해 대본 내용, 관련 번역 메타데이터, 선택적 지침이 사용자의 OpenAI API 키를 통해 OpenAI로 전송됩니다. 이 전송은 사용자가 요청한 직접 AI 번역 기능을 수행하기 위한 목적에 한정됩니다.

사용자가 내보낸 내용을 복사하여 외부 AI 또는 번역 서비스에 직접 붙여넣는 경우, 해당 행위는 확장 외부에서 사용자가 직접 수행하는 것입니다. 그 제3자 서비스의 개인정보 처리 방식은 해당 서비스의 정책을 따릅니다.

### 원격 코드

이 확장은 원격 코드를 사용하지 않습니다.

### 사용자 선택

사용자는 다음을 수행할 수 있습니다.

- 확장 라이브러리에서 저장된 스크립트를 삭제할 수 있습니다
- 저장 전 가져오기 입력 내용을 비울 수 있습니다
- 확장을 제거하여 이후 접근을 중단할 수 있습니다

### 문의

개인정보 관련 문의는 이 확장의 Chrome Web Store 등록 정보에 기재된 게시자 연락처를 이용해 주세요.
