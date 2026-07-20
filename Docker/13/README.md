# Docker Compose 實戰（一）：多容器 Python 應用

Docker Compose 是「用一份設定檔描述整套系統」的工具：把第 04 到 11 章那些又長又多的 `docker run` 指令，濃縮成一份看得懂、改得動、進得了版本控制的 YAML，然後一句 `docker compose up` 全部長出來。

第 11 章你手工搭三層架構搭得滿頭汗——建網、起容器、connect、掛設定，十幾條指令。這一章玄貓把那整包工事翻譯成一份 Compose 檔，你會親眼看到「宣告式」三個字的威力：你只描述「我要什麼」，Compose 負責搞定「怎麼做出來」。