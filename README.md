# ORBITAL LIMB (`orbital-limb`)

Industrial Monochrome FUI (Fictional User Interface) Holographic Globe & Orbital Telemetry Wallpaper Project.

## Overview
**ORBITAL LIMB**는 화면 전체에 작은 지구본을 띄우는 대신, **거대하게 확대한 점·선 기반 홀로그램 지구본을 우측 하단으로 비대칭 배치(Planetary Limb Framing)**하고 뷰포트 경계로 갈수록 자연스럽게 어둠 속으로 페이드아웃시키는 인더스트리얼 모노크롬 스타일의 웹 월페이퍼 프로젝트입니다.

## Key Features (v0.1.0 - Main Hero Prototype)
- **Planetary Limb Composition (구도 A)**:
  - 우측/우측 하단으로 중심축을 이동시킨 거대 지구본의 둥근 지평선 호(Limb)를 메인 스테이지에 배치하고, 향후 터미널(CLI) 및 텔레메트리 정보가 들어갈 좌측 여백(Negative Space)을 자연스럽게 확보.
- **Shader-Level Viewport & Beam Attenuation**:
  - 모든 점·선 레이어의 Fragment Shader에 스크린 공간(`screenUv`) 사각 경계 감쇠 및 타원형 볼륨 빔 감쇠(`smoothstep`)를 적용하여, 뷰포트 가장자리와 맞닿는 부분이 잘리지 않고 서서히 투명해지도록 처리.
- **4-Tier Point & Line Hologram Architecture**:
  1. **Graticule & Fiducial Crosses (`+`)**: 10° 간격의 경위도 점선 그리드, 적도/회귀선 강조선 및 교차점마다 배치된 1px 십자(`+`) 마커.
  2. **1:50m Vector Coastlines**: Natural Earth 1:50m 지형 데이터를 기반으로 한 정밀 해안선 벡터.
  3. **Latitude-Compensated Hex Dot Matrix**: 위도별 코사인 보정(`cos(lat)`)이 적용된 균일 밀도 대륙 포인트 클라우드 및 주요 거점 도시(서울, 도쿄, 뉴욕, 런던 등) 오렌지 레티클 비콘.
  4. **Astrometric Orbital Rings**: 눈금(Tick marks)과 실시간 궤도 패킷 트레일이 흐르는 다중 궤도 링.
- **Real-Time Astronomical Solar Terminator**:
  - 외부 API 없이 현재 UTC 시각으로부터 태양의 적위(Declination)와 시간각을 순수 수학 공식으로 계산하여 지구본 표면의 낮/밤 경계선(Terminator Line)을 실시간 반영.
- **Wallpaper-Grade Low-GPU Optimization**:
  - 런타임 지오메트리 재생성 Zero (단일 초기화 후 100% GLSL `uniform` 기반 애니메이션).
  - 45 FPS 스마트 프레임 제한 및 비활성 화면 자동 일시정지.

## Directory Structure
```text
orbital-limb/
├── index.html
├── README.md
├── CHANGELOG.md
└── assets/
    ├── css/
    │   └── main.css
    ├── data/
    │   └── land-50m.json
    └── js/
        ├── main.js
        ├── core/
        │   └── solarMath.js
        ├── globe/
        │   └── hologramGlobe.js
        ├── shader/
        │   └── globeShaders.js
        └── lib/
            ├── three.module.min.js
            └── topojson-client.esm.js
```

## Running Locally
ES Module 및 `fetch('./assets/data/land-50m.json')` 로드를 위해 로컬 정적 웹 서버(예: VS Code Live Server, `npx serve .`, `python -m http.server`)를 통해 실행합니다.
