# Machbase Neo LiDAR Demo

KITTI raw autonomous-driving data를 Machbase Neo에 저장하고, 브라우저에서 3D LiDAR point cloud와 차량 pose를 재생하는 데모입니다.

이 문서는 처음 실행하는 사람도 그대로 따라 할 수 있도록 **Git clone부터 시작해서** 설치, 데이터 다운로드, DB 로딩, 서버 실행, 데모 확인 순서로 정리했습니다.

GitHub repository:

```text
https://github.com/machbase/neo-lidar-demo.git
```

## Step 1. 준비물 확인

필요한 것:

- Linux shell
- Git
- Machbase Neo 실행 파일
- 실행 중인 Machbase Neo DB
- 인터넷 연결
- 디스크 여유 공간. KITTI zip과 압축 해제 파일이 저장되므로 넉넉하게 준비합니다.

이 프로젝트는 일반 Node.js 서버가 아니라 **Machbase Neo JSH runtime**에서 실행됩니다. 모든 `.js` 스크립트는 아래처럼 실행합니다.

```sh
<machbase-neo> jsh <script.js>
```

현재 개발 환경에서 확인된 실행 파일 예시는 다음과 같습니다.

```sh
/home/sjkim/work/neo/current/machbase-neo
```

환경마다 경로가 다를 수 있으므로, 먼저 실행 파일이 있는지 확인합니다.

```sh
ls -l /home/sjkim/work/neo/current/machbase-neo
```

편의를 위해 shell 변수로 등록합니다.

```sh
export NEO=/home/sjkim/work/neo/current/machbase-neo
```

동작 확인:

```sh
$NEO version
```

Machbase Neo DB가 떠 있어야 합니다. 이 데모 스크립트는 기본적으로 `127.0.0.1:5656`에 접속합니다.

## Step 2. Git clone으로 프로젝트 받기

작업 디렉터리를 만듭니다.

```sh
mkdir -p ~/work/neo/current/public
cd ~/work/neo/current/public
```

누구나 바로 실행하기 쉬운 HTTPS URL로 clone합니다.

```sh
git clone https://github.com/machbase/neo-lidar-demo.git
```

SSH key가 GitHub에 등록되어 있으면 SSH URL을 사용해도 됩니다.

```sh
git clone git@github.com:machbase/neo-lidar-demo.git
```

clone이 끝나면 프로젝트 디렉터리로 이동합니다.

```sh
cd ~/work/neo/current/public/neo-lidar-demo
```

현재 브랜치와 파일을 확인합니다.

```sh
git status
ls -la
```

디렉터리 구조는 대략 다음과 같습니다.

```text
app/             JSH HTTP server
lib/             DB/API/KITTI helper code
scripts/         download, schema, ingest scripts
public/          browser frontend
data/            local dataset directory
```

이미 이 저장소가 `/home/sjkim/work/neo/current/public/neo-lidar-demo`에 있다면 clone 단계는 생략하고 아래처럼 이동하면 됩니다.

```sh
cd /home/sjkim/work/neo/current/public/neo-lidar-demo
```

다른 이름의 디렉터리에 clone했다면, 이후 명령은 그 디렉터리 안에서 실행하면 됩니다.

## Step 3. Machbase Neo DB 접속 기본값

스크립트는 기본적으로 아래 DB 접속값을 사용합니다.

```text
host: 127.0.0.1
port: 5656
user: sys
password: manager
```

다른 DB에 연결해야 하면 환경변수로 지정합니다.

```sh
export PHY_DB_HOST=127.0.0.1
export PHY_DB_PORT=5656
export PHY_DB_USER=sys
export PHY_DB_PASSWORD=manager
```

접속값을 바꿨다면 이후 모든 `$NEO jsh ...` 명령이 같은 환경변수를 사용합니다.

## Step 4. 데이터 다운로드와 unzip

데모는 KITTI raw 데이터 중 두 개 drive를 사용합니다.

```text
2011_09_30_drive_0028_sync
2011_10_03_drive_0027_sync
```

다운로드와 압축 해제는 분리해서 진행합니다. 이 문서에서는 JSH 스크립트를 ZIP 파일 다운로드에만 사용하고, 압축 해제는 OS의 외부 unzip 프로그램을 사용합니다. 두 drive zip만 약 37 GiB이므로 ZIP과 압축 해제 결과를 둘 다 저장할 디스크 공간을 충분히 확보해야 합니다.

### 4-1. ZIP 다운로드

```sh
$NEO jsh scripts/download-data.js --out data/raw/kitti --parallel 4 --chunk-mb 64 --download-only
```

`--parallel`은 동시에 받는 range chunk 수이고 `--chunk-mb`는 chunk 크기입니다. JSH HTTP 클라이언트는 range chunk를 파일에 쓰기 전에 메모리에 올리므로 다운로드 중 메모리 사용량은 대략 `parallel * chunk-mb` MiB 이상으로 잡아야 합니다. 스크립트는 기본적으로 이 값이 1024MiB를 넘으면 중단합니다. 메모리가 적은 WSL에서는 `--parallel 2 --chunk-mb 32`처럼 더 낮춰서 실행합니다.

다운로드되는 주요 파일:

```text
data/raw/kitti/archives/2011_09_30_calib.zip
data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip
data/raw/kitti/archives/2011_10_03_calib.zip
data/raw/kitti/archives/2011_10_03_drive_0027_sync.zip
```

### 4-2. Linux 또는 WSL에서 unzip

```sh
unzip -o data/raw/kitti/archives/2011_09_30_calib.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_10_03_calib.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_10_03_drive_0027_sync.zip -d data/raw/kitti
```

`unzip`이 없으면 먼저 설치합니다.

```sh
sudo apt update
sudo apt install unzip
```

### 4-3. Windows PowerShell에서 unzip

Windows에서 프로젝트 디렉터리를 열고 PowerShell로 실행합니다.

```powershell
$dest = "data\raw\kitti"
$archives = "data\raw\kitti\archives"

Expand-Archive -Force -Path "$archives\2011_09_30_calib.zip" -DestinationPath $dest
Expand-Archive -Force -Path "$archives\2011_09_30_drive_0028_sync.zip" -DestinationPath $dest
Expand-Archive -Force -Path "$archives\2011_10_03_calib.zip" -DestinationPath $dest
Expand-Archive -Force -Path "$archives\2011_10_03_drive_0027_sync.zip" -DestinationPath $dest
```

7-Zip을 사용한다면 같은 위치에서 아래처럼 풀 수 있습니다.

```powershell
$dest = "data\raw\kitti"
$archives = "data\raw\kitti\archives"

7z x "$archives\2011_09_30_calib.zip" "-o$dest" -y
7z x "$archives\2011_09_30_drive_0028_sync.zip" "-o$dest" -y
7z x "$archives\2011_10_03_calib.zip" "-o$dest" -y
7z x "$archives\2011_10_03_drive_0027_sync.zip" "-o$dest" -y
```

압축 해제 후 주요 디렉터리:

```text
data/raw/kitti/2011_09_30/2011_09_30_drive_0028_sync/
data/raw/kitti/2011_10_03/2011_10_03_drive_0027_sync/
```

데이터가 제대로 있는지 확인합니다.

```sh
$NEO jsh scripts/check-data.js --data-root data/raw/kitti --sequence 2011_09_30_drive_0028_sync
$NEO jsh scripts/check-data.js --data-root data/raw/kitti --sequence 2011_10_03_drive_0027_sync
```

JSH 출력의 `cwd`가 `/work`로 보이더라도 정상입니다. 스크립트는 상대 `--data-root`를 셸에서 실행한 프로젝트 루트 기준으로 해석합니다.

`velodyne_points/data`가 `true`로 나오면 LiDAR frame 파일이 있는 것입니다.

frame 수를 shell에서 확인할 수도 있습니다.

```sh
find data/raw/kitti -path '*/velodyne_points/data/*.bin' -type f | wc -l
```

현재 전체 로딩 대상은 `9721` frames입니다.

## Step 5. DB 테이블 생성

테이블과 인덱스를 생성합니다.

```sh
$NEO jsh scripts/schema.js
```

생성되는 데모 테이블:

```text
PHY_TIMELINE
PHY_LIDAR_FRAME
```

주요 인덱스:

```text
IDX_PHY_TIMELINE_FRAME_ID
IDX_PHY_LIDAR_FRAME_ID
```

테이블 목록 확인:

```sh
$NEO jsh scripts/list-tables.js
```

인덱스 확인:

```sh
$NEO jsh scripts/list-indexes.js
```

## Step 6. 기존 데모 테이블을 초기화하고 다시 만들기

이미 로딩한 데이터를 지우고 처음부터 다시 시작하려면 아래 명령을 사용합니다.

주의: `PHY_TIMELINE`, `PHY_LIDAR_FRAME` 데이터가 삭제됩니다.

```sh
$NEO jsh scripts/reset-schema.js
```

초기화 후 테이블과 인덱스가 다시 생성됩니다.

## Step 7. 데이터 로딩

로컬 KITTI 데이터를 Machbase Neo에 로딩합니다.

```sh
$NEO jsh scripts/ingest.js --data-root data/raw/kitti
```

기본 로딩 대상:

```text
2011_09_30_drive_0028_sync
2011_10_03_drive_0027_sync
```

로딩 결과는 하나의 논리 sequence로 저장됩니다.

```text
dataset: kitti-raw
sequence: kitti-raw-10m
```

로딩되는 내용:

```text
PHY_TIMELINE
  frame별 pose, speed, point_count, event metadata JSON

PHY_LIDAR_FRAME
  frame별 원본 Velodyne .bin binary
```

전체 로딩 결과는 다음과 같아야 합니다.

```text
frames: 9721
lidar: 9721
```

일부만 테스트 로딩하고 싶으면 `--limit`을 사용할 수 있습니다.

```sh
$NEO jsh scripts/reset-schema.js
$NEO jsh scripts/ingest.js --data-root data/raw/kitti --limit 300
```

전체 데모를 보려면 `--limit` 없이 다시 로딩해야 합니다.

## Step 8. DB에 어떻게 저장되는가

원본 KITTI 파일과 DB 저장 관계는 다음과 같습니다.

| 로컬 원본 파일 | DB 저장 위치 |
|---|---|
| `velodyne_points/data/*.bin` | `PHY_LIDAR_FRAME.value` |
| `velodyne_points/timestamps.txt` | `PHY_TIMELINE.time`, `PHY_LIDAR_FRAME.time` |
| `oxts/data/*.txt` | `PHY_TIMELINE.value` JSON 내부 pose/speed |
| `image_00~03` | 현재 데모에서는 DB에 저장하지 않음 |
| `calib_*.txt` | 현재 데모에서는 DB에 저장하지 않음 |

LiDAR binary는 PNG 이미지가 아니라 point cloud입니다.

한 점은 다음 4개 `float32` 값으로 구성됩니다.

```text
x, y, z, intensity
```

한 점은 16 bytes이고, frame 하나는 이 점들의 반복입니다.

## Step 9. 데모 서버 실행

개발 중 터미널에서 바로 실행하려면:

```sh
$NEO jsh app/server.js --host 127.0.0.1 --port 56802
```

터미널을 닫아도 서버가 계속 살아있게 실행하려면:

```sh
mkdir -p .run
setsid $NEO jsh app/server.js --host 127.0.0.1 --port 56802 > .run/server-56802.log 2>&1 < /dev/null &
echo $! > .run/server-56802.pid
```

서버 확인:

```sh
curl http://127.0.0.1:56802/api/health
```

정상 응답:

```json
{"app":"phy-ai-demo","ok":true}
```

참고: health 응답의 `app` 값은 내부 데모 식별자입니다. GitHub 저장소 이름은 `neo-lidar-demo`입니다.

서버 로그 확인:

```sh
tail -f .run/server-56802.log
```

서버 중지:

```sh
kill $(cat .run/server-56802.pid)
```

## Step 10. 브라우저에서 데모 보기

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:56802/
```

화면에서 확인할 수 있는 것:

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

URL로 카메라를 직접 지정할 수도 있습니다.

```text
http://127.0.0.1:56802/?camera=top
http://127.0.0.1:56802/?camera=side
http://127.0.0.1:56802/?camera=hood
```

## Step 11. 현재 로딩된 데이터 범위

현재 기본 전체 로딩 기준:

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

주의: `kitti-raw-10m`은 논리 sequence 이름입니다. 실제로는 로컬에 다운로드한 두 drive 전체를 이어 붙여 로딩합니다.

## Step 12. API 확인

manifest:

```sh
curl http://127.0.0.1:56802/api/manifest
```

pose 전체 로딩:

```sh
curl http://127.0.0.1:56802/api/poses
```

특정 frame metadata:

```sh
curl 'http://127.0.0.1:56802/api/frame?frameId=100'
```

특정 frame point cloud:

```sh
curl 'http://127.0.0.1:56802/api/points?frameId=100&lod=2'
```

LOD 의미:

```text
LOD 0: 원본 point에 가장 가까움
LOD 1: 4개 중 1개 point 사용
LOD 2: 12개 중 1개 point 사용
```

DB에는 LOD별 데이터를 따로 저장하지 않습니다. DB에는 원본 LiDAR binary만 저장하고, API가 요청 시 downsample합니다.

## Step 13. 한 화면을 그릴 때 실행되는 SQL

초기 화면 로딩:

```sql
SELECT dataset, sequence, MIN(time) min_time, MAX(time) max_time, COUNT(*) frame_count
FROM PHY_TIMELINE
GROUP BY dataset, sequence
ORDER BY dataset, sequence
LIMIT 20;
```

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

## Step 14. 문제 해결

### 브라우저에서 연결 거부가 나올 때

서버가 떠 있는지 확인합니다.

```sh
ss -ltnp | grep 56802
```

서버가 없으면 다시 실행합니다.

```sh
mkdir -p .run
setsid $NEO jsh app/server.js --host 127.0.0.1 --port 56802 > .run/server-56802.log 2>&1 < /dev/null &
echo $! > .run/server-56802.pid
```

### 데이터가 안 보일 때

먼저 manifest를 확인합니다.

```sh
curl http://127.0.0.1:56802/api/manifest
```

`frameCount`가 `0`이거나 synthetic fallback이 나오면 DB 로딩이 안 된 것입니다.

다시 로딩합니다.

```sh
$NEO jsh scripts/reset-schema.js
$NEO jsh scripts/ingest.js --data-root data/raw/kitti
```

### 데이터 다운로드가 중간에 끊겼을 때

다운로드 파일은 `data/raw/kitti/archives` 아래에 있습니다. 중간에 끊기면 먼저 같은 명령을 다시 실행합니다. 스크립트는 `.parts` 디렉터리의 완료된 chunk와 `.part` 조립 파일을 재사용합니다.

계속 실패하거나 파일 크기가 맞지 않는 zip이 남아 있으면 해당 zip, `.part`, `.parts`만 지우고 다시 실행합니다.

```sh
rm -rf data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip \
       data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip.part \
       data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip.parts
$NEO jsh scripts/download-data.js --out data/raw/kitti --parallel 4 --chunk-mb 64 --download-only
```

다운로드는 끝났는데 압축 해제 중 실패했다면 ZIP을 다시 받지 말고 외부 unzip 명령만 다시 실행합니다. Linux 또는 WSL에서는 아래처럼 다시 풉니다.

```sh
unzip -o data/raw/kitti/archives/2011_09_30_calib.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_10_03_calib.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_10_03_drive_0027_sync.zip -d data/raw/kitti
```

`--parallel 16 --chunk-mb 512`처럼 실행하면 다운로드 단계에서만 동시에 최대 8192MiB 이상의 버퍼가 필요할 수 있습니다. 이런 설정은 메모리가 넉넉한 환경에서만 `--max-inflight-mb`로 명시적으로 허용합니다.

### 포인트가 느리게 뜰 때

먼저 LOD 2로 봅니다. LOD 0은 훨씬 많은 point를 그립니다.

또한 인덱스가 생성되어 있는지 확인합니다.

```sh
$NEO jsh scripts/list-indexes.js
```

`IDX_PHY_LIDAR_FRAME_ID`가 있어야 합니다.

## Step 15. Git clone부터 전체 처음 실행하는 빠른 순서

아래는 새 머신 또는 빈 작업 디렉터리에서 시작하는 전체 절차입니다. 이미 clone되어 있으면 `git clone` 부분은 생략합니다.

```sh
# 1. Machbase Neo 실행 파일 위치를 지정합니다.
export NEO=/home/sjkim/work/neo/current/machbase-neo

# 2. 프로젝트를 받을 위치로 이동합니다.
mkdir -p ~/work/neo/current/public
cd ~/work/neo/current/public

# 3. GitHub에서 프로젝트를 받습니다.
git clone https://github.com/machbase/neo-lidar-demo.git

# SSH key를 사용하고 싶으면 아래 SSH clone을 대신 사용합니다.
# git clone git@github.com:machbase/neo-lidar-demo.git

# 4. 프로젝트 디렉터리로 이동합니다.
cd neo-lidar-demo

# 5. 데이터 ZIP 파일을 병렬 다운로드합니다.
#    drive zip만 약 37 GiB이므로 디스크 여유 공간이 필요합니다.
$NEO jsh scripts/download-data.js --out data/raw/kitti --parallel 4 --chunk-mb 64 --download-only

# 6. Linux 또는 WSL에서 외부 unzip 프로그램으로 압축을 풉니다.
unzip -o data/raw/kitti/archives/2011_09_30_calib.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_09_30_drive_0028_sync.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_10_03_calib.zip -d data/raw/kitti
unzip -o data/raw/kitti/archives/2011_10_03_drive_0027_sync.zip -d data/raw/kitti

# 7. 데이터가 제대로 풀렸는지 확인합니다.
$NEO jsh scripts/check-data.js --data-root data/raw/kitti --sequence 2011_09_30_drive_0028_sync
$NEO jsh scripts/check-data.js --data-root data/raw/kitti --sequence 2011_10_03_drive_0027_sync

# 8. 기존 데모 테이블을 지우고 새로 만듭니다.
$NEO jsh scripts/reset-schema.js

# 9. KITTI 데이터를 Machbase Neo DB에 로딩합니다.
$NEO jsh scripts/ingest.js --data-root data/raw/kitti

# 10. 데모 서버를 백그라운드로 실행합니다.
mkdir -p .run
setsid $NEO jsh app/server.js --host 127.0.0.1 --port 56802 > .run/server-56802.log 2>&1 < /dev/null &
echo $! > .run/server-56802.pid

# 11. 서버가 정상인지 확인합니다.
curl http://127.0.0.1:56802/api/health
```

마지막으로 브라우저에서 엽니다.

```text
http://127.0.0.1:56802/
```
