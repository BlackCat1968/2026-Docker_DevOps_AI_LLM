#!/usr/bin/env python3
"""image_recon.py：映像檔瘦身偵察——找肥層、抓孤兒"""
import docker


def fmt_mb(size_bytes: int) -> str:
    return f"{size_bytes / 2**20:8.1f} MB"


def scan_fat_layers(client: docker.DockerClient, top_n: int = 5) -> None:
    print(f"=== 全機最肥的 {top_n} 個建置層 ===")
    records = []
    for image in client.images.list():
        tag = image.tags[0] if image.tags else "<none>"
        for entry in image.history():
            if entry["Size"] > 0:
                cmd = entry["CreatedBy"].replace("/bin/sh -c ", "")[:60]
                records.append((entry["Size"], tag, cmd))

    seen = set()
    shown = 0
    for size, tag, cmd in sorted(records, reverse=True):
        if (size, cmd) in seen:
            continue
        seen.add((size, cmd))
        print(f"{fmt_mb(size)}  {tag:<28} {cmd}")
        shown += 1
        if shown >= top_n:
            break


def scan_dangling(client: docker.DockerClient) -> None:
    orphans = client.images.list(filters={"dangling": True})
    total = sum(img.attrs["Size"] for img in orphans)
    print(f"\n=== 懸空映像檔 {len(orphans)} 個,共佔 {fmt_mb(total)} ===")
    for img in orphans:
        print(f"{fmt_mb(img.attrs['Size'])}  {img.short_id}")
    if orphans:
        print("建議執行: docker image prune -f")


if __name__ == "__main__":
    cli = docker.from_env()
    scan_fat_layers(cli)
    scan_dangling(cli)