# Android Dependency Tree Diff Viewer

Android 프로젝트의 의존성 그래프 변경사항을 쉽게 비교할 수 있는 웹 도구입니다.

Gradle의 `dependencies` 태스크 출력을 비교하여 변경된 의존성과 그 경로를 시각적으로 표시합니다.

<br>

<div align="center">
  <img width="700" alt="image" src="https://github.com/user-attachments/assets/ef010cbc-aad7-4f3e-85d3-3c9f1a31088d" />  
</div>

<br>
<br>

## 출력 방식

3가지 출력 방식을 제공합니다:

### 1. 전체 출력
일반적인 파일 diff처럼 모든 내용을 보여줍니다.

<img width="500" alt="image" src="https://github.com/user-attachments/assets/f8c7acfb-7e17-4b8e-9df8-3b8665835168" />

### 2. 변경된 부분만 출력
추가되거나 삭제된 의존성만 표시합니다.

<img width="500" alt="image" src="https://github.com/user-attachments/assets/a46146d7-024d-4dfd-b6b4-a08444d4f1f0" />

### 3. 요약
추가/삭제/변경된 의존성을 카테고리별로 요약하여 표시합니다.

<img width="500" alt="image" src="https://github.com/user-attachments/assets/45cf48d6-ed8a-4017-a67d-741507dd3aa8" />


## 사용 방법

### 1. 의존성 파일 생성

```bash
# 변경 전
./gradlew app:dependencies --configuration releaseRuntimeClassPath > before.txt

# 의존성 변경 후
./gradlew app:dependencies --configuration releaseRuntimeClassPath > after.txt
```

#### Configuration 종류
- **RuntimeClassPath**: 실제 앱 실행 시 필요한 의존성 (APK에 포함되는 라이브러리들) - **권장**
- **CompileClassPath**: 컴파일 시에만 필요한 의존성 (API, annotation processor 등)

💡 APK 크기나 실제 앱 의존성 확인 시 `RuntimeClassPath` 권장

### 2. 비교하기

1. [Android Dependency Diff Viewer](https://donglab-devtools.github.io/Android-Dependency-Tree-Diff-Viewer/) 사이트 접속
2. "기존 의존성 파일"에 `before.txt` 업로드
3. "변경된 의존성 파일"에 `after.txt` 업로드  
4. "비교하기" 버튼 클릭

---
