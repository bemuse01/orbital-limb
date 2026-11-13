# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-11-13

### Added
- **Initial Project Setup**:
  - `orbital-limb` 프로젝트 구조 생성 및 오프라인 독립 실행을 위한 `three.module.min.js`, `topojson-client.esm.js`, Natural Earth `land-50m.json` 에셋 구성.
- **Main Holographic Globe Prototype (구도 A + 인더스트리얼 모노크롬)**:
  - 우측 하단 쏠림 및 대구경 확대 구도(Planetary Limb Framing) 구현.
  - Fragment Shader 기반 뷰포트 사방 경계 및 타원형 볼륨 페이드아웃(`computeViewportFade`) 구현.
  - 10° 경위도 그리드 선 및 교차점 `+` 마이크로 크로스헤어(`FIDUCIAL_CROSS_SHADER`) 레이어 구현.
  - 1:50m 정밀 해안선 벡터(`COASTLINE_SHADER`) 및 위도 보정 육각형 대륙 도트 매트릭스(`LAND_POINTS_SHADER`) 구현.
  - 주요 거점 도시(서울, 도쿄, 뉴욕 등 26개 노드) 인더스트리얼 오렌지(`#ff3e14`) 다이아몬드 비콘 및 위도 스캔 파장 연출 추가.
  - 다중 각도 눈금 궤도 링(`ORBITAL_RING_SHADER`) 및 대기권 프레넬 림 글로우(`ATMOSPHERE_LIMB_SHADER`) 추가.
- **Real-Time Solar Math & Low-Power Loop**:
  - `solarMath.js`: 현재 UTC 시각 기반 실시간 태양 위치 및 주야간 경계선(Terminator) 계산 모듈 구현.
  - `main.js`: 월페이퍼 환경을 고려한 45 FPS 프레임 제한기 및 `document.hidden` 자동 절전 루프 적용.
