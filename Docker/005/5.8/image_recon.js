#!/usr/bin/env node
/**
 * image_recon.js:映像檔瘦身偵察——找肥層、抓孤兒
 *
 * 需先安裝:npm install dockerode
 */
'use strict';

const Docker = require('dockerode');

function fmtMb(sizeBytes) {
  const mb = (sizeBytes / 2 ** 20).toFixed(1);
  return `${mb.padStart(8)} MB`;
}

// dockerode 的 image ID 形如 "sha256:<64 位十六進位>",
// 這裡模擬 docker-py 的 short_id:前綴加上 10 位雜湊值
function shortId(id) {
  const [algo, hash] = id.includes(':') ? id.split(':') : ['', id];
  return algo ? `${algo}:${hash.slice(0, 10)}` : hash.slice(0, 12);
}

async function scanFatLayers(docker, topN = 5) {
  console.log(`=== 全機最肥的 ${topN} 個建置層 ===`);

  const images = await docker.listImages();
  const records = [];

  for (const summary of images) {
    const tag = summary.RepoTags && summary.RepoTags.length ? summary.RepoTags[0] : '<none>';
    const history = await docker.getImage(summary.Id).history();

    for (const entry of history) {
      if (entry.Size > 0) {
        const cmd = (entry.CreatedBy || '').replace('/bin/sh -c ', '').slice(0, 60);
        records.push({ size: entry.Size, tag, cmd });
      }
    }
  }

  // 依大小由大到小排序
  records.sort((a, b) => b.size - a.size);

  const seen = new Set();
  let shown = 0;

  for (const { size, tag, cmd } of records) {
    const key = `${size}\u0000${cmd}`;
    if (seen.has(key)) continue;
    seen.add(key);

    console.log(`${fmtMb(size)}  ${tag.padEnd(28)} ${cmd}`);
    shown += 1;
    if (shown >= topN) break;
  }
}

async function scanDangling(docker) {
  const orphans = await docker.listImages({ filters: { dangling: ['true'] } });
  const total = orphans.reduce((sum, img) => sum + img.Size, 0);

  console.log(`\n=== 懸空映像檔 ${orphans.length} 個,共佔 ${fmtMb(total)} ===`);

  for (const img of orphans) {
    console.log(`${fmtMb(img.Size)}  ${shortId(img.Id)}`);
  }

  if (orphans.length > 0) {
    console.log('建議執行: docker image prune -f');
  }
}

async function main() {
  // 等同 docker.from_env():自動讀取 DOCKER_HOST 等環境變數,
  // 未設定時退回本機 socket
  const docker = new Docker();

  await scanFatLayers(docker);
  await scanDangling(docker);
}

main().catch((err) => {
  console.error('偵察失敗:', err.message);
  process.exit(1);
});