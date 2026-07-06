# Ubuntu：查詢發行版資訊
lsb_release -a

# 查詢核心版本（容器功能需要較新的核心，5.x 以上都沒問題）
uname -r

# 移除可能衝突的舊套件(沒裝過會顯示找不到,屬正常)
sudo apt-get remove -y docker.io docker-doc docker-compose podman-docker containerd runc

# 更新套件索引並安裝掛載官方來源需要的工具
sudo apt-get update
sudo apt-get install -y ca-certificates curl

# 建立金鑰存放目錄並下載 Docker 官方 GPG 金鑰
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 寫入官方套件庫來源,依系統架構與版本代號自動填值
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  # 重新整理索引後安裝 Docker 全家餐
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# 確認服務狀態,Ubuntu 套件裝完會自動啟動並設定開機自啟
systemctl status docker --no-pager

# 若未啟動,手動啟動並設定開機自啟
sudo systemctl enable --now docker

# 煙霧測試
sudo docker run hello-world

# 把目前使用者加入 docker 群組
sudo usermod -aG docker $USER

# 讓群組變更立即在目前 shell 生效(或直接登出再登入)
newgrp docker

# 驗證:不加 sudo 也能跑
docker run hello-world