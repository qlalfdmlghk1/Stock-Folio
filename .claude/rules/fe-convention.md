# Frontend Convention

> 이 문서는 FE 컨벤션 변경 시 함께 업데이트합니다.

이 파일은 프로젝트의 프론트엔드 개발 컨벤션을 정의합니다.

---

## FSD (Feature-Sliced Design) 아키텍처

프로젝트는 FSD 아키텍처를 따릅니다.

### 레이어 구조

```
src/
├── app/                    # 앱 초기화 (진입점)
│   ├── plugins/            # 플러그인 (pinia, vue-query 등)
│   ├── router/             # 라우터 설정
│   ├── layouts/            # 레이아웃 컴포넌트
│   └── styles/             # 전역 스타일
├── pages/                  # 페이지 (file-based routing)
├── widgets/                # 복합 UI 블록 (여러 features 조합)
├── features/               # 기능 단위 (사용자 행동)
├── entities/               # 비즈니스 엔티티
│   └── {entity}/
│       ├── api/            # API 함수
│       ├── model/          # composables, types, store
│       └── ui/             # 엔티티 관련 UI
└── shared/                 # 공유 자원
    ├── api/                # API 클라이언트, 공통 타입
    ├── lib/                # 유틸리티 함수
    └── ui/                 # 공통 UI 컴포넌트 (Atomic Design)
        ├── atoms/          # 최소 단위 (Button, Input, Icon 등)
        ├── molecules/      # atoms 조합 (FormField, SearchInput 등)
        ├── organisms/      # 복잡한 UI 블록 (필요시에만)
        └── theme/          # 디자인 토큰
```

### Import 방향 규칙 (강제)

- 상위 레이어 → 하위 레이어 import만 허용
- 같은 레이어 내 슬라이스 간 import 금지
- 순환 참조 절대 금지

| From     | Import 허용                                     |
| -------- | ----------------------------------------------- |
| shared   | 어디서든 ✅                                     |
| entities | shared ✅ / features, pages, widgets, app ❌    |
| features | shared, entities ✅ / pages, widgets, app ❌    |
| widgets  | shared, entities, features ✅ / pages, app ❌   |
| pages    | shared, entities, features, widgets ✅ / app ❌ |
| app      | 모든 레이어 ✅                                  |

---

## 상태 관리

### Pinia (클라이언트 상태)

- UI 상태, 사용자 설정, 앱 전역 상태에 사용
- Composition API stores 사용
- 파일 위치: `entities/{entity}/model/*.store.ts` 또는 `shared/model/*.store.ts`

```typescript
// entities/user/model/user.store.ts
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', () => {
  const currentUser = ref<User | null>(null)

  function setUser(user: User) {
    currentUser.value = user
  }

  return { currentUser, setUser }
})
```

### Vue Query (서버 상태)

- API 데이터 캐싱, 자동 리페치, 낙관적 업데이트에 사용
- 파일 위치: `entities/{entity}/model/use{Entity}Query.ts`

#### Query Key Factory 패턴 (강제)

Query 키는 Factory 패턴으로 관리합니다.

```typescript
// entities/report/model/useReportQuery.ts
export const reportKeys = {
  all: ['reports'] as const,
  lists: () => [...reportKeys.all, 'list'] as const,
  list: (params: GetReportsParams) => [...reportKeys.lists(), params] as const,
  summaries: () => [...reportKeys.all, 'summary'] as const,
  summary: (params: GetSummaryParams) => [...reportKeys.summaries(), params] as const,
  details: () => [...reportKeys.all, 'detail'] as const,
  detail: (id: number) => [...reportKeys.details(), id] as const,
}
```

#### 반응형 Query 파라미터 (권장)

필터 조건이 변경되면 자동으로 재조회되도록 `computed`로 파라미터를 전달합니다.

```typescript
// entities/report/model/useReportQuery.ts
import { useQuery } from '@tanstack/vue-query'
import { computed, type Ref, type ComputedRef } from 'vue'

export function useReportListQuery(params: Ref<GetReportsParams> | ComputedRef<GetReportsParams>) {
  return useQuery({
    queryKey: computed(() => reportKeys.list(params.value)),
    queryFn: () => reportApi.getReportList(params.value),
    select: (response) => ({
      data: response.data as ReportListItem[],
      total: response.pageInfo?.total ?? 0,
    }),
  })
}
```

#### Query와 필터 Composable 조합 패턴 (권장)

페이지 로직은 필터 상태 관리와 Query를 조합한 Composable로 분리합니다.

```typescript
// entities/report/model/useReportList.ts
import { computed, ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useReportListQuery, useReportSummaryQuery, useTeamsQuery } from './useReportQuery'

export function useReportList() {
  // ===== 필터 상태 =====
  const dateRange = ref<DateRange>({ start: defaultStart, end: defaultEnd })
  const selectedTeams = ref<string[]>([])
  const searchKeyword = ref('')
  const debouncedSearchKeyword = ref('')
  const currentPage = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)

  // 디바운스 처리
  watchDebounced(searchKeyword, (v) => { debouncedSearchKeyword.value = v }, { debounce: 300 })

  // ===== Query 파라미터 (computed) =====
  const listParams = computed<GetReportsParams>(() => ({
    startDate: formatDateParam(dateRange.value.start),
    endDate: formatDateParam(dateRange.value.end),
    teamIds: selectedTeams.value.length > 0 ? selectedTeams.value : undefined,
    q: debouncedSearchKeyword.value || undefined,
    page: currentPage.value,
    pageSize: pageSize.value,
  }))

  // ===== Vue Query Hooks =====
  const { data: listData, isLoading, isFetching } = useReportListQuery(listParams)
  const { data: summaryData } = useReportSummaryQuery(summaryParams)
  const { data: teamsData } = useTeamsQuery()

  // ===== Computed 데이터 =====
  const reportData = computed(() => listData.value?.data ?? [])
  const totalCount = computed(() => listData.value?.total ?? 0)

  // 필터 변경 시 페이지 리셋
  watch([dateRange, selectedTeams, debouncedSearchKeyword], () => {
    currentPage.value = 1
  }, { deep: true })

  return { dateRange, selectedTeams, searchKeyword, reportData, totalCount, isLoading, ... }
}
```

#### staleTime 설정 (권장)

자주 변하지 않는 데이터는 `staleTime`을 설정하여 불필요한 재요청을 방지합니다.

```typescript
export function useTeamsQuery() {
  return useQuery({
    queryKey: reportKeys.teams(),
    queryFn: () => reportApi.getTeams(),
    select: (response) => response.data as Team[],
    staleTime: 5 * 60 * 1000, // 5분간 신선하게 유지
  })
}
```

#### Mutation 예시

```typescript
// 생성 mutation
export function useCreateUserMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    }
  })
}
```

### Pinia vs Vue Query 사용 기준

| 상황                      | 사용 라이브러리     |
| ------------------------- | ------------------- |
| API 응답 데이터 캐싱      | Vue Query           |
| 서버 데이터 실시간 동기화 | Vue Query           |
| 낙관적 업데이트           | Vue Query           |
| 폼 상태 관리              | Pinia 또는 로컬 ref |
| 모달/사이드바 열림 상태   | Pinia 또는 로컬 ref |
| 사용자 인증 정보          | Pinia               |
| 테마/언어 설정            | Pinia               |

---

## 컴포넌트 개발

1. 적절한 FSD 레이어에 컴포넌트 생성
2. `shared/ui/`의 공통 컴포넌트는 Atomic Design 원칙 준수
3. 문서화를 위한 Storybook stories 추가
4. 일관된 스타일링을 위해 design tokens 사용

### 공통 컴포넌트 수정 시 필수 작업 (강제)

`shared/ui/` 컴포넌트 수정 시 반드시 함께 수정:

1. **Storybook 스토리 파일** (`*.stories.ts`)
   - 새로운 prop 추가 시 → argTypes에 추가, 해당 prop 사용하는 스토리 추가
   - prop 삭제/변경 시 → 기존 스토리 업데이트
2. **테스트 파일** (`*.spec.ts`, `*.test.ts`)
   - 테스트가 존재하는 경우 → 영향받는 테스트 케이스 수정
   - 새로운 기능 추가 시 → 테스트 케이스 추가 권장

### Atomic Design (shared/ui/ 전용)

`shared/ui/`에만 Atomic Design을 적용합니다. `entities/`, `features/`, `widgets/`는 FSD 규칙을 따릅니다.

| 분류      | 설명                                      | 예시                                                            |
| --------- | ----------------------------------------- | --------------------------------------------------------------- |
| atoms     | 더 이상 분해할 수 없는 최소 UI 단위       | AppButton, AppInput, AppIcon, AppBadge                          |
| molecules | 2개 이상의 atoms 조합                     | FormField (Label + Input + Error), SearchInput (Input + Button) |
| organisms | molecules/atoms 조합으로 독립적 기능 수행 | (필요시에만 생성)                                               |

**분류 원칙:**

- 도메인 로직이 포함되면 `entities/` 또는 `features/`로 이동
- 재사용 가능성이 낮으면 해당 레이어에 직접 배치
- atoms 내부에서 다른 atoms import 가능 (예: AppIcon을 사용하는 AppButton)

---

## 스타일링

- design token 변수와 함께 SCSS 사용
- 적용 가능한 곳에 BEM 네이밍 컨벤션 준수
- 자동 주입되는 token 변수 활용
- **중요**: `src/shared/ui/theme/tokens/build/scss/variables.scss`에 존재하는 SCSS 변수만 사용

### 사용 가능한 SCSS 변수

> **참고**: 실제 변수는 `src/shared/ui/theme/tokens/build/scss/_variables.scss` 파일 참조

**Colors:**

- Base: `$color-white`, `$color-black`
- Primary Blue: `$color-primary-blue-100` ~ `$color-primary-blue-900`
- Primary Purple: `$color-primary-purple-100` ~ `$color-primary-purple-900`
- Secondary GrayBlue: `$color-secondary-grayblue-100` ~ `$color-secondary-grayblue-900`
- Gray: `$color-gray-100` ~ `$color-gray-900`
- Neutral: `$color-neutral-100` ~ `$color-neutral-900`
- Green: `$color-green-100` ~ `$color-green-900`
- Yellow: `$color-yellow-100` ~ `$color-yellow-900`
- Error: `$color-sub-error-100` ~ `$color-sub-error-900`
- Info: `$color-sub-info-100` ~ `$color-sub-info-900`

**Typography (복합 font shorthand):**

- Headline: `$headline-h1` (700 32px), `$headline-h2` (600 28px), `$headline-h3` (600 20px), `$headline-h4` (600 18px), `$headline-h5` (600 16px), `$headline-h6` (600 14px/140%)
- Body: `$body-b24`, `$body-b20`, `$body-b18`, `$body-b16`, `$body-b14`, `$body-b12` (모두 400 weight, 140% line-height)

**Typography (개별 속성):**

- Font family: `$font-family-pretendard`
- Font weights: `$font-weight-bold` (700), `$font-weight-semibold` (600), `$font-weight-regular` (400)
- Font sizes: `$font-size-12`, `$font-size-14`, `$font-size-16`, `$font-size-18`, `$font-size-20`, `$font-size-24`, `$font-size-28`, `$font-size-32`
- Line heights: `$font-line-height-140` (140%), `$font-line-height-auto` (normal)

---

## Design Token 빌드 프로세스

- `src/shared/ui/theme/tokens/` 하위에 JSON 형식으로 tokens 정의
- Style Dictionary와 커스텀 transforms로 빌드
- 모든 stylesheets에 자동 주입되는 SCSS 변수 생성

---

## 파일 네이밍 컨벤션

- **Components**: PascalCase 디렉토리와 PascalCase.vue 파일
- **Atoms**: `shared/ui/atoms/{ComponentName}/{ComponentName}.vue`
- **Molecules**: `shared/ui/molecules/{ComponentName}/{ComponentName}.vue`
- **Stores**: `*.store.ts`
- **Types**: TypeScript 정의용 `*.type.ts`
- **APIs**: API 레이어 정의용 `*.api.ts`
- **Queries**: Vue Query hooks용 `use*Query.ts`

---

## Import 전략

- src root에서 absolute imports를 위해 `@/` alias 사용
- 페이지 컴포넌트는 file-based routing 활용
- barrel export (`index.ts`)를 통한 public API 노출
- 프로젝트 코드는 명시적 import 사용 (FSD 레이어 경계 명확화)

### Auto-import 범위

다음은 import 문 없이 사용 가능합니다:

| 종류 | 대상 | 예시 |
|------|------|------|
| Vue API | `vue` 전체 | `ref`, `computed`, `watch`, `onMounted` |
| Vue Router API | `vue-router` 전체 | `useRouter`, `useRoute` |
| 컴포넌트 | `shared/ui`, `widgets/**/ui`, `features/**/ui`, `entities/**/ui` | `AppButton`, `AppDialog` |
| Composables | `src/composables/` | |
| Utils | `src/utils/` | |

**명시적 import 필요**:
- 타입 (`import type { ... }`)
- API 함수 (`entities/**/api`, `shared/api`)
- Model (`entities/**/model`, `features/**/model`)
- 외부 라이브러리

**Claude 코드 작성 규칙 (강제)**:
- 위 auto-import 대상은 import 문 생략
- 그 외는 반드시 명시적 import 작성

---

## Vue 컨벤션

### SFC 블록 순서 (강제)

1. `<script setup lang="ts">`
2. `<template>`
3. `<style scoped>`

### 비즈니스 로직 분리 (강제)

- `pages/*` 또는 단일 `.vue` 파일에 로직 집중 금지
- 컴포넌트에는 UI 이벤트 처리만

| 유형                         | 위치                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| Vue 반응성/라이프사이클 결합 | `entities/{entity}/model/` 또는 `features/{feature}/model/` |
| 순수 로직 (계산, 포맷, 매핑) | `shared/lib/`                                               |
| 전역 상태                    | `*.store.ts`                                                |
| 서버 상태                    | `use*Query.ts` (Vue Query)                                  |

### 컴포넌트 책임 제한 (강제)

Vue 파일은 다음 역할만 담당:

- props/emits 정의
- UI 렌더링
- 이벤트 핸들러 연결

**금지 사항:**

- 50줄 이상의 `<script setup>` 로직
- API 호출 직접 작성
- 복잡한 데이터 변환/계산
- 여러 store 조합 로직

**분리 기준:**

- 로직이 길어지면 → `model/` composables로 추출
- 재사용 가능한 계산 → `shared/lib/`로 추출
- 상태 공유 필요 → `*.store.ts`로 이동
- 서버 데이터 → `use*Query.ts`로 이동

### Composable 네이밍 (강제)

- `use` prefix 필수
- 예: `useUsers`, `useUserDetail`, `useUsersQuery`

---

## TypeScript 컨벤션

### 함수 선언 방식 (강제)

| 위치                       | 권장                 |
| -------------------------- | -------------------- |
| `shared/lib/`, `**/model/` | function declaration |
| component 내부             | arrow function       |

### interface vs type (강제)

- 객체 구조 / 확장 목적 → `interface`
- 유니온 / 튜플 / 조합 타입 → `type`

### any 사용 금지 (강제)

- `any` 타입 사용 금지
- 예외 시: 사유 + TODO 주석 명시

---

## API 개발 가이드라인

- **Response Types**: `src/shared/api/api.type.ts`의 `SuccessResponse<T>`와 `ErrorResponse` 항상 사용
- **Type Safety**: API 응답용 specific data types 정의하고 `SuccessResponse<T>`와 함께 사용
- **일관된 구조**: 모든 API 함수는 `ApiResponse<T>` 타입 반환
- **Error Handling**: 적절한 error codes와 messages를 포함한 표준화된 error response 형식 사용

### API 구현 예시

```typescript
// entities/user/api/user.api.ts
import { $api } from '@/shared/api'
import type { ApiResponse } from '@/shared/api'
import type { User } from '../model/user.type'

export interface GetUsersParams {
  searchKeyword?: string
  searchType?: string
}

export async function getUsers(params?: GetUsersParams): Promise<ApiResponse<User[]>> {
  return $api<ApiResponse<User[]>>('/api/users', { params })
}

export async function getUserById(userId: number): Promise<ApiResponse<User>> {
  return $api<ApiResponse<User>>(`/api/users/${userId}`)
}
```

---

## Storybook

공통 컴포넌트와 디자인 토큰 문서화를 위해 Storybook을 사용합니다.

### 스토리 파일 위치 (FSD 구조)

스토리 파일은 해당 컴포넌트와 같은 디렉토리에 위치합니다.

```
src/
├── shared/ui/
│   └── AppButton/
│       ├── AppButton.vue
│       └── AppButton.stories.ts    # ✅ 컴포넌트 옆에 배치
├── entities/user/ui/
│   └── UserCard/
│       ├── UserCard.vue
│       └── UserCard.stories.ts
├── features/auth/ui/
│   └── LoginForm/
│       ├── LoginForm.vue
│       └── LoginForm.stories.ts
└── widgets/
    └── Header/
        ├── Header.vue
        └── Header.stories.ts
```

### 스토리 네이밍 컨벤션

```typescript
// shared/ui atoms
title: 'shared/ui/atoms/AppButton'

// shared/ui molecules
title: 'shared/ui/molecules/FormField'

// entities, features, widgets는 기존 FSD 규칙 유지
title: 'entities/user/ui/UserCard'
title: 'features/auth/ui/LoginForm'
title: 'widgets/Header'
```

### 스토리 작성 원칙

1. **autodocs 태그 필수**: 자동 문서화 활성화
2. **주요 상태 커버**: Default, Disabled, Loading, Error 등
3. **argTypes 정의**: props 설명 및 controls 설정
4. **예시 코드 명시**: `parameters.docs.source.code`로 사용 예시 제공

### 예시 코드 작성 (강제)

각 스토리에 `parameters.docs.source.code`를 사용하여 실제 사용 예시를 명시합니다.

```typescript
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import AppButton from './AppButton.vue'

const meta: Meta<typeof AppButton> = {
  title: 'shared/ui/atoms/AppButton',
  component: AppButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline'],
      description: '버튼 스타일 변형'
    },
    disabled: {
      control: 'boolean',
      description: '비활성화 상태'
    }
  }
}

export default meta
type Story = StoryObj<typeof AppButton>

export const Primary: Story = {
  args: {
    variant: 'primary',
    default: '확인'
  },
  parameters: {
    docs: {
      source: {
        code: `<AppButton variant="primary">확인</AppButton>`
      }
    }
  }
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    default: '취소'
  },
  parameters: {
    docs: {
      source: {
        code: `<AppButton variant="secondary">취소</AppButton>`
      }
    }
  }
}

export const Disabled: Story = {
  args: {
    variant: 'primary',
    disabled: true,
    default: '비활성화'
  },
  parameters: {
    docs: {
      source: {
        code: `<AppButton variant="primary" disabled>비활성화</AppButton>`
      }
    }
  }
}

// 복잡한 사용 예시
export const WithIcon: Story = {
  args: {
    variant: 'primary'
  },
  render: (args) => ({
    components: { AppButton },
    setup() {
      return { args }
    },
    template: `
      <AppButton v-bind="args">
        <template #icon>🔍</template>
        검색
      </AppButton>
    `
  }),
  parameters: {
    docs: {
      source: {
        code: `
<AppButton variant="primary">
  <template #icon>🔍</template>
  검색
</AppButton>
        `.trim()
      }
    }
  }
}
```

### 실행 명령어

```bash
npm run storybook        # 개발 서버 (포트 6006)
npm run build-storybook  # 정적 빌드
npm run test:storybook   # 스토리 테스트
```

---

## 테스트 작성 가이드

### 테스트 작성 워크플로우 (강제)

테스트 코드 작성 요청 시 다음 순서를 반드시 따릅니다:

**1단계: 기능 분석**
- 테스트 대상 파일을 읽고 기능 파악
- 의존성 (import, store, API 등) 확인
- 핵심 로직과 분기 조건 식별

**2단계: 이해 확인 (질문)**
- 분석한 기능의 의도가 맞는지 사용자에게 확인
- 불명확한 비즈니스 로직에 대해 질문
- 테스트 범위 (어떤 케이스를 커버할지) 합의

**3단계: 테스트 작성**
- 합의된 범위에 맞춰 테스트 코드 작성
- Mock 전략, 테스트 구조 설명

**4단계: 검증 (필수)**
- 테스트 실행: `npx vitest run [파일경로]`
- 타입 체크: `npx tsc --noEmit --project tsconfig.app.json 2>&1 | grep "[파일명]"`
- IDE에서 타입 에러 없는지 확인 안내

### 테스트 작성 원칙 (강제)

**테스트 코드 작성 전 반드시:**

1. 해당 기능을 완전히 이해한 상태에서 작성
2. 명확하지 않은 부분이 있으면 사용자에게 질문하여 확인
3. 추측으로 테스트 작성 금지

### 단위 테스트 (Vitest)

**파일 위치**: 테스트 대상과 같은 디렉토리에 `*.spec.ts` 또는 `*.test.ts`

```
src/entities/user/model/
├── useUsers.ts
└── useUsers.spec.ts    # ✅ 같은 디렉토리
```

**테스트 대상 우선순위**:

1. composables (비즈니스 로직)
2. store (상태 관리)
3. utils (유틸리티 함수)
4. API 함수

**실행 명령어**:

```bash
npm run test           # 단위 테스트 실행
npm run test:watch     # watch 모드
npm run test:coverage  # 커버리지 리포트
```

**예시**:

```typescript
// entities/user/model/useUsers.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { useUsers } from './useUsers'

describe('useUsers', () => {
  it('초기 상태에서 users는 빈 배열이어야 한다', () => {
    const { users } = useUsers()
    expect(users.value).toEqual([])
  })

  it('fetchUsers 호출 시 loading이 true가 되어야 한다', async () => {
    const { loading, fetchUsers } = useUsers()

    const fetchPromise = fetchUsers()
    expect(loading.value).toBe(true)

    await fetchPromise
    expect(loading.value).toBe(false)
  })
})
```

### E2E 테스트 (Playwright)

**파일 위치**: `e2e/` 디렉토리

```
e2e/
├── auth/
│   └── login.spec.ts
├── users/
│   └── user-list.spec.ts
└── fixtures/
    └── users.json
```

**테스트 작성 원칙**:

1. 사용자 시나리오 기반 작성
2. 핵심 플로우 우선 커버
3. 테스트 데이터는 fixtures로 관리
4. Page Object Model 패턴 권장

**실행 명령어**:

```bash
npm run test:e2e       # E2E 테스트 실행
npm run test:e2e:ui    # UI 모드로 실행
```

**예시**:

```typescript
// e2e/users/user-list.spec.ts
import { test, expect } from '@playwright/test'

test.describe('사용자 목록', () => {
  test('사용자 목록 페이지 접속 시 목록이 표시되어야 한다', async ({ page }) => {
    await page.goto('/users')

    await expect(page.getByRole('heading', { name: 'User List' })).toBeVisible()
    await expect(page.locator('.user-item')).toHaveCount.greaterThan(0)
  })

  test('사용자 클릭 시 상세 페이지로 이동해야 한다', async ({ page }) => {
    await page.goto('/users')

    await page.locator('.user-item').first().click()

    await expect(page).toHaveURL(/\/users\/\d+/)
    await expect(page.getByRole('heading', { name: /User Details/ })).toBeVisible()
  })
})
```

### 테스트 우선순위

| 우선순위 | 대상                                | 도구               |
| -------- | ----------------------------------- | ------------------ |
| 1        | 비즈니스 로직 (composables, stores) | Vitest             |
| 2        | 유틸리티 함수                       | Vitest             |
| 3        | 핵심 사용자 플로우                  | Playwright         |
| 4        | 컴포넌트 렌더링/인터랙션            | Storybook + Vitest |

---

## ESLint 검증 (강제)

코드 작성/수정 완료 후 **반드시 ESLint를 실행**하여 오류가 없는지 확인합니다.

### 검증 시점

- 새 파일 생성 후
- 기존 파일 수정 완료 후
- 커밋 전

### 검증 명령어

```bash
# 특정 파일 검사
npx eslint <파일경로>

# 특정 디렉토리 검사
npx eslint <디렉토리>/**/*.ts

# 자동 수정 가능한 오류 수정
npx eslint --fix <파일경로>
```

### 흔한 오류 유형

| 오류 | 원인 | 해결 |
|------|------|------|
| `'x' is defined but never used` | 변수/파라미터 미사용 | 제거하거나 `_x`로 명시적 무시 |
| `'x' is assigned but never used` | 할당 후 미사용 | 할당 제거 또는 활용 |
| `Unexpected any` | any 타입 사용 | 구체적 타입으로 변경 |

### 예외 처리

의도적으로 무시해야 하는 경우:

```typescript
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _intentionallyUnused = value
```
