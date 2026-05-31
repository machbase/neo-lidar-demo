# Machbase Neo LiDAR Demo

KITTI raw autonomous-driving data를 Machbase Neo에 저장하고, 브라우저에서 3D LiDAR point cloud와 차량 pose를 재생하는 데모입니다.

  <table>
    <tr>
      <td width="33%">
        <img src="https://github.com/machbase/neo-lidar-demo/blob/main/doc/images/neo-lidar-1.png" alt="Neo LiDAR demo 1" width="100%">
      </td>
      <td width="33%">
        <img src="https://github.com/machbase/neo-lidar-demo/blob/main/doc/images/neo-lidar-2.png" alt="Neo LiDAR demo 2" width="100%">
      </td>
      <td width="33%">
        <img src="https://github.com/machbase/neo-lidar-demo/blob/main/doc/images/neo-lidar-3.png" alt="Neo LiDAR demo 3" width="100%">
      </td>
    </tr>
  </table>


GitHub repository:
```text
https://github.com/machbase/neo-lidar-demo.git
```

## 실행 환경 구분

이 문서는 명령 실행 위치를 명시합니다.

| 표기 | 의미 | 사용하는 명령 |
|---|---|---|
| Linux shell | OS 터미널 | `git`, `unzip`, `curl`, `ss`, 환경변수 설정 |
| JSH shell | Machbase Neo JSH 내부 shell | `./scripts/*.js`, `./server.js` |
| PowerShell | Windows PowerShell | `Expand-Archive` |

중요:

- JSH shell은 Linux shell이 아닙니다.
- JSH shell 내부에는 `export` 명령이 없습니다.
- `export`, `unzip`, `curl`, `ss`, redirection, `setsid` 같은 명령은 Linux shell에서 실행합니다.
- `.js` 스크립트는 JSH shell에서 실행합니다.

이 문서의 경로 가정:

```text
Linux shell: <NEO_HOME>/neo-lidar-demo
JSH shell:   /work/neo-lidar-demo
```

`<NEO_HOME>`은 Machbase Neo가 설치된 디렉토리입니다. JSH shell에서는 같은 설치 디렉토리가 `/work`로 보인다고 가정합니다.

## 전체 흐름

1. Linux shell에서 `<NEO_HOME>` 아래에 repository를 clone합니다.
2. JSH shell에서 KITTI zip을 다운로드합니다.
3. Linux shell 또는 PowerShell에서 zip을 풉니다.
4. JSH shell에서 데이터 확인, 스키마 생성, ingest를 실행합니다.
5. JSH shell에서 데모 API/UI 서버를 실행합니다.
6. Linux shell에서 API 상태를 확인하고 브라우저로 접속합니다.

## 준비물

- Linux shell
- Git
- Machbase Neo 설치 디렉토리
- 실행 중인 Machbase Neo DB
- 인터넷 연결
- 충분한 디스크 공간

KITTI drive zip만 약 37 GiB입니다. zip 파일과 압축 해제 결과를 모두 저장할 공간을 준비합니다.

Machbase Neo DB 접속 기본값:

```text
host: 127.0.0.1
port: 5656
user: sys
password: manager
```

다른 DB 접속값을 써야 하면 Linux shell에서 Machbase Neo/JSH를 시작하기 전에 환경변수를 설정합니다. 이미 떠 있는 JSH shell 내부에서 `export`를 입력하는 방식은 아닙니다.

```sh
# Linux shell
export PHY_DB_HOST=127.0.0.1
export PHY_DB_PORT=5656
export PHY_DB_USER=sys
export PHY_DB_PASSWORD=manager
```

## 1. 프로젝트 받기

Linux shell에서 실행합니다.

```sh
# Linux shell
cd <NEO_HOME>
git clone https://github.com/machbase/neo-lidar-demo.git
cd neo-lidar-demo
git status
ls -la
```

SSH key가 GitHub에 등록되어 있으면 SSH URL을 사용할 수 있습니다.

```sh
# Linux shell
cd <NEO_HOME>
git clone git@github.com:machbase/neo-lidar-demo.git
cd neo-lidar-demo
```

디렉토리 구조:

```text
app/             JSH HTTP server
lib/             DB/API/KITTI helper code
scripts/         download, schema, ingest scripts
public/          browser frontend
data/            local dataset directory
```

JSH shell에서는 프로젝트가 아래 경로로 보여야 합니다.

```text
/work/neo-lidar-demo
```

## 2. KITTI 데이터 다운로드

JSH shell에서 실행합니다.

```text
/ > cd /work/neo-lidar-demo
/work/neo-lidar-demo > ./scripts/download-data.js --out data/raw/kitti --parallel 4 --chunk-mb 64 --download-only
```

사용 데이터:

```text
2011_09_30_drive_0028_sync
2011_10_03_drive_0027_sync
```

다운로드되는 주요 파일:

```text
data/raw/kitti/archives/2011_09_30_calib.zip
data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip
data/raw/kitti/archives/2011_10_03_calib.zip
data/raw/kitti/archives/2011_10_03_drive_0027_sync.zip
```

`--parallel`은 동시에 받는 range chunk 수이고 `--chunk-mb`는 chunk 크기입니다. JSH HTTP 클라이언트는 range chunk를 파일에 쓰기 전에 메모리에 올리므로 다운로드 중 메모리 사용량은 대략 `parallel * chunk-mb` MiB 이상으로 잡아야 합니다.

메모리가 적은 환경에서는 아래처럼 낮춰서 실행합니다.

```text
/work/neo-lidar-demo > ./scripts/download-data.js --out data/raw/kitti --parallel 2 --chunk-mb 32 --download-only
```

## 3. 압축 해제

압축 해제는 JSH shell이 아니라 OS shell에서 실행합니다.

Linux shell 또는 WSL:

```sh
# Linux shell, cwd: <NEO_HOME>/neo-lidar-demo
unzip -o data/raw/kitti/archives/2011_09_30_calib.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_10_03_calib.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_10_03_drive_0027_sync.zip -d data/raw/kitti
```

`unzip`이 없으면 Linux shell에서 설치합니다.

```sh
# Linux shell
sudo apt update
sudo apt install unzip
```

Windows PowerShell:

```powershell
# PowerShell, cwd: <NEO_HOME>\neo-lidar-demo
$dest = "data\raw\kitti"
$archives = "data\raw\kitti\archives"

Expand-Archive -Force -Path "$archives\2011_09_30_calib.zip" -DestinationPath $dest
Expand-Archive -Force -Path "$archives\2011_09_30_drive_0028_sync.zip" -DestinationPath $dest
Expand-Archive -Force -Path "$archives\2011_10_03_calib.zip" -DestinationPath $dest
Expand-Archive -Force -Path "$archives\2011_10_03_drive_0027_sync.zip" -DestinationPath $dest
```

7-Zip:

```powershell
# PowerShell, cwd: <NEO_HOME>\neo-lidar-demo
$dest = "data\raw\kitti"
$archives = "data\raw\kitti\archives"

7z x "$archives\2011_09_30_calib.zip" "-o$dest" -y
7z x "$archives\2011_09_30_drive_0028_sync.zip" "-o$dest" -y
7z x "$archives\2011_10_03_calib.zip" "-o$dest" -y
7z x "$archives\2011_10_03_drive_0027_sync.zip" "-o$dest" -y
```

압축 해제 후 주요 디렉토리:

```text
data/raw/kitti/2011_09_30/2011_09_30_drive_0028_sync/
data/raw/kitti/2011_10_03/2011_10_03_drive_0027_sync/
```

## 4. 데이터 확인

JSH shell에서 스크립트로 확인합니다.

```text
/work/neo-lidar-demo > ./scripts/check-data.js --data-root data/raw/kitti --sequence 2011_09_30_drive_0028_sync
/work/neo-lidar-demo > ./scripts/check-data.js --data-root data/raw/kitti --sequence 2011_10_03_drive_0027_sync
```

`velodyne_points/data`가 `true`로 나오면 LiDAR frame 파일이 있는 것입니다.

Linux shell에서 frame 수를 직접 확인할 수도 있습니다.

```sh
# Linux shell, cwd: <NEO_HOME>/neo-lidar-demo
find data/raw/kitti -path '*/velodyne_points/data/*.bin' -type f | wc -l
```

전체 로딩 대상은 `9721` frames입니다.

## 5. 스키마 생성

JSH shell에서 실행합니다.

```text
/work/neo-lidar-demo > ./scripts/schema.js
```

생성되는 테이블:

```text
PHY_TIMELINE
PHY_LIDAR_FRAME
```

주요 인덱스:

```text
IDX_PHY_TIMELINE_FRAME_ID
IDX_PHY_LIDAR_FRAME_ID
```

확인:

```text
/work/neo-lidar-demo > ./scripts/list-tables.js
/work/neo-lidar-demo > ./scripts/list-indexes.js
```

기존 데모 테이블을 지우고 다시 만들려면 아래를 실행합니다.

```text
/work/neo-lidar-demo > ./scripts/reset-schema.js
```

주의: `PHY_TIMELINE`, `PHY_LIDAR_FRAME` 데이터가 삭제됩니다.

## 6. 데이터 로딩

JSH shell에서 실행합니다.

```text
/work/neo-lidar-demo > ./scripts/ingest.js --data-root data/raw/kitti
```

일부만 테스트 로딩하려면 `--limit`을 사용합니다.

```text
/work/neo-lidar-demo > ./scripts/reset-schema.js
/work/neo-lidar-demo > ./scripts/ingest.js --data-root data/raw/kitti --limit 300
```

전체 데모를 보려면 `--limit` 없이 다시 로딩해야 합니다.

로딩 결과는 하나의 논리 sequence로 저장됩니다.

```text
dataset: kitti-raw
sequence: kitti-raw-10m
```

전체 로딩 결과는 다음과 같아야 합니다.

```text
frames: 9721
lidar: 9721
```

## 7. 데모 서버 실행

JSH shell에서 `app` 디렉토리로 이동한 뒤 실행합니다.

```text
/work/neo-lidar-demo > cd app
/work/neo-lidar-demo/app > ./server.js --host 127.0.0.1 --port 56802
```

정상 시작 메시지:

```text
neo-lidar-demo server started tcp 127.0.0.1:56802
```

서버는 foreground에서 실행됩니다. 중지하려면 실행 중인 JSH shell에서 `Ctrl+C`를 누릅니다.

Gin debug mode 경고가 출력될 수 있습니다.

```text
[GIN-debug] [WARNING] Running in "debug" mode.
```

이 경고는 데모 실행을 막지 않습니다. 로그를 줄여야 하는 운영 환경에서는 JSH shell 내부가 아니라 Machbase Neo process 또는 service를 시작하는 Linux 환경에 `GIN_MODE=release`를 설정합니다.

```sh
# Linux shell, Machbase Neo/JSH를 시작하기 전에 설정
export GIN_MODE=release
```

## 8. 서버 확인과 브라우저 접속

서버 확인은 Linux shell에서 실행합니다.

```sh
# Linux shell
curl http://127.0.0.1:56802/api/health
```

정상 응답:

```json
{"app":"neo-lidar-demo","ok":true}
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:56802/
```

Machbase Neo HTTP 서버의 package 경로에서도 열 수 있습니다. 이 경우에도 `56802` 데모 API 서버가 같이 떠 있어야 합니다.

```text
http://127.0.0.1:5654/db/tql/neo-lidar-demo/public/index.html
```

API 서버 포트를 바꿔 실행했다면 `apiBase`를 URL에 지정합니다.

```text
http://127.0.0.1:5654/db/tql/neo-lidar-demo/public/index.html?apiBase=http://127.0.0.1:56803
```

## 화면 기능

- 3D LiDAR point cloud
- 차량 모델
- frame 번호
- speed
- point count
- LOD 선택
- point cloud 색상 모드와 범례
- source frame, raw/shown point 비율, downsample 배율, query latency
- top view 미니맵과 10m/25m/50m range ring
- 카메라 선택
- timeline 재생

카메라 옵션:

```text
Orbit
Chase
High Chase
Hood
Top
Side
Front
```

카메라 조작:

- `Orbit` 모드: 마우스 드래그, 휠, 우클릭 드래그로 자유 시점을 조작합니다.
- 추적 모드: 차량 추적은 유지한 상태에서 마우스 휠로 거리 확대/축소, 우클릭 드래그 또는 Shift+드래그로 프레이밍을 이동합니다.
- 추적 모드에서 더블클릭하면 현재 카메라의 거리와 프레이밍 보정을 초기화합니다.

URL로 카메라를 직접 지정할 수 있습니다.

```text
http://127.0.0.1:56802/?camera=top
http://127.0.0.1:56802/?camera=side
http://127.0.0.1:56802/?camera=hood
```

## 로딩 데이터

기본 전체 로딩 기준:

```text
2011_09_30_drive_0028_sync: 5177 frames
2011_10_03_drive_0027_sync: 4544 frames
합계: 9721 frames
```

DB timeline 시간 범위:

```text
2011-09-30 12:42:41.831
~
2011-09-30 12:59:30.665
```

약 16분 49초 분량입니다.

`kitti-raw-10m`은 논리 sequence 이름입니다. 실제로는 로컬에 다운로드한 두 drive 전체를 이어 붙여 로딩합니다.

원본 KITTI 파일과 DB 저장 관계:

| 로컬 원본 파일 | DB 저장 위치 |
|---|---|
| `velodyne_points/data/*.bin` | `PHY_LIDAR_FRAME.value` |
| `velodyne_points/timestamps.txt` | `PHY_TIMELINE.time`, `PHY_LIDAR_FRAME.time` |
| `oxts/data/*.txt` | `PHY_TIMELINE.value` JSON 내부 pose/speed |
| `image_00~03` | 현재 데모에서는 DB에 저장하지 않음 |
| `calib_*.txt` | 현재 데모에서는 DB에 저장하지 않음 |

LiDAR binary는 PNG 이미지가 아니라 point cloud입니다. 한 점은 16 bytes이며 다음 4개 `float32` 값으로 구성됩니다.

```text
x, y, z, intensity
```

## API 확인

Linux shell에서 실행합니다.

```sh
# Linux shell
curl http://127.0.0.1:56802/api/manifest
curl http://127.0.0.1:56802/api/poses
curl 'http://127.0.0.1:56802/api/frame?frameId=100'
curl 'http://127.0.0.1:56802/api/points?frameId=100&lod=2'
```

LOD 의미:

```text
LOD 0: 원본 point에 가장 가까움
LOD 1: 4개 중 1개 point 사용
LOD 2: 12개 중 1개 point 사용
```

DB에는 LOD별 데이터를 따로 저장하지 않습니다. DB에는 원본 LiDAR binary만 저장하고, API가 요청 시 downsample합니다.

## 주요 SQL

초기 manifest:

```sql
SELECT dataset, sequence, MIN(time) min_time, MAX(time) max_time, COUNT(*) frame_count
FROM PHY_TIMELINE
GROUP BY dataset, sequence
ORDER BY dataset, sequence
LIMIT 20;
```

pose cache 로딩:

```sql
SELECT time, value, frame_id
FROM PHY_TIMELINE
WHERE name = 'kitti-raw.kitti-raw-10m.timeline'
ORDER BY frame_id
LIMIT 20000;
```

재생 중 LiDAR frame 갱신:

```sql
SELECT value, point_count, byte_count
FROM PHY_LIDAR_FRAME
WHERE name = 'kitti-raw.kitti-raw-10m.velodyne.raw'
  AND frame_id = ?
LIMIT 1;
```

차량 pose와 카메라는 브라우저 메모리에 미리 로딩한 pose cache에서 처리하므로, 매 렌더 프레임마다 SQL이 실행되지는 않습니다.

## 문제 해결

### 브라우저에서 연결 거부가 나올 때

Linux shell에서 서버 포트를 확인합니다.

```sh
# Linux shell
ss -ltnp | grep 56802
```

서버가 없으면 JSH shell에서 다시 실행합니다.

```text
/ > cd /work/neo-lidar-demo/app
/work/neo-lidar-demo/app > ./server.js --host 127.0.0.1 --port 56802
```

### 5654 package URL에서 화면은 뜨지만 플레이가 안 될 때

아래 API 서버가 같이 떠 있어야 합니다.

```text
/work/neo-lidar-demo/app > ./server.js --host 127.0.0.1 --port 56802
```

그리고 Linux shell에서 API가 응답하는지 확인합니다.

```sh
# Linux shell
curl http://127.0.0.1:56802/api/health
```

### 데이터가 안 보일 때

Linux shell에서 manifest를 확인합니다.

```sh
# Linux shell
curl http://127.0.0.1:56802/api/manifest
```

`frameCount`가 `0`이거나 synthetic fallback이 나오면 DB 로딩이 안 된 것입니다. JSH shell에서 다시 로딩합니다.

```text
/work/neo-lidar-demo > ./scripts/reset-schema.js
/work/neo-lidar-demo > ./scripts/ingest.js --data-root data/raw/kitti
```

### 데이터 다운로드가 중간에 끊겼을 때

먼저 JSH shell에서 같은 다운로드 명령을 다시 실행합니다. 스크립트는 `.parts` 디렉토리의 완료된 chunk와 `.part` 조립 파일을 재사용합니다.

```text
/work/neo-lidar-demo > ./scripts/download-data.js --out data/raw/kitti --parallel 4 --chunk-mb 64 --download-only
```

계속 실패하거나 파일 크기가 맞지 않는 zip이 남아 있으면 Linux shell에서 해당 zip, `.part`, `.parts`만 지우고 다시 실행합니다.

```sh
# Linux shell, cwd: <NEO_HOME>/neo-lidar-demo
rm -rf data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip \
       data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip.part \
       data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip.parts
```

그 다음 JSH shell에서 다운로드를 재시도합니다.

```text
/work/neo-lidar-demo > ./scripts/download-data.js --out data/raw/kitti --parallel 4 --chunk-mb 64 --download-only
```

다운로드는 끝났는데 압축 해제 중 실패했다면 ZIP을 다시 받지 말고 OS shell에서 압축 해제만 다시 실행합니다.

### 포인트가 느리게 뜰 때

먼저 LOD 2로 봅니다. LOD 0은 훨씬 많은 point를 그립니다.

인덱스가 생성되어 있는지도 JSH shell에서 확인합니다.

```text
/work/neo-lidar-demo > ./scripts/list-indexes.js
```

`IDX_PHY_LIDAR_FRAME_ID`가 있어야 합니다.
