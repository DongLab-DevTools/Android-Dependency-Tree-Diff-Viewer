# Android Dependency Tree Diff Viewer

Android 프로젝트의 의존성 그래프 변경사항을 쉽게 비교할 수 있는 웹 도구입니다.

Gradle의 `dependencies` 태스크 출력을 비교하여 변경된 의존성과 그 경로를 시각적으로 표시합니다.

## 의존성 변경 표시 방식

이 도구는 일반적인 diff와 달리, **변경된 의존성의 루트 경로까지 모두 표시**합니다.

```diff
 +--- com.squareup.sqldelight:android-driver:1.4.0
 |    +--- com.squareup.sqldelight:runtime-jvm:1.4.0
-|    |    +--- org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.3.72
-|    |    |    \--- org.jetbrains.kotlin:kotlin-stdlib:1.3.72 (*)
+|    |    +--- org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.3.72 -> 1.4.0
+|    |    |    \--- org.jetbrains.kotlin:kotlin-stdlib:1.4.0 (*)
-|    |    \--- org.jetbrains.kotlin:kotlin-stdlib-common:1.3.72
+|    |    \--- org.jetbrains.kotlin:kotlin-stdlib-common:1.3.72 -> 1.4.0
-|    \--- org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.3.72 (*)
+|    \--- org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.3.72 -> 1.4.0 (*)
 \--- com.squareup.sqldelight:rxjava2-extensions:1.4.0
-     \--- org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.3.72 (*)
+     \--- org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.3.72 -> 1.4.0 (*)
```

**결과 해석:**
- `+` : 추가된 의존성 또는 버전
- `-` : 제거된 의존성 또는 버전  
- ` ` (공백) : 변경되지 않았지만 변경된 의존성의 경로를 보여주기 위해 표시
- `->` : 버전 변경 (예: `1.3.72 -> 1.4.0`)

변경되지 않은 의존성도 **변경된 항목의 부모 경로인 경우에만** 표시되어, 어떤 루트 의존성으로부터 변경이 발생했는지 명확하게 파악할 수 있습니다.

## 사용 방법

### 1. 의존성 파일 생성

```bash
# 변경 전
./gradlew app:dependencies --configuration releaseRuntimeClasspath > before.txt

# 의존성 변경 후
./gradlew app:dependencies --configuration releaseRuntimeClasspath > after.txt
```

### 2. 비교하기

1. [Android Dependency Diff Viewer](https://dongx0915.github.io/Android-Dependecy-Tree-Diff-Viewer/) 사이트 접속
2. "기존 의존성 파일"에 `before.txt` 업로드
3. "변경된 의존성 파일"에 `after.txt` 업로드  
4. "비교하기" 버튼 클릭

---

> 이 도구는 [JakeWharton/dependency-tree-diff](https://github.com/JakeWharton/dependency-tree-diff)의 알고리즘을 개선하여 웹으로 포팅한 것입니다.
