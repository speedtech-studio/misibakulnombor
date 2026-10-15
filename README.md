# MISI BAKUL NOMBOR — Gaya Version 1 + Webcam Latar + Fullscreen Game

Versi ini mengekalkan reka bentuk asal Version 1, dengan sasaran nombor, buah dan bakul yang lebih besar. Dalam mod webcam, video kamera (termasuk tangan dan latar sebenar) memenuhi bahagian belakang permainan seperti contoh webcam quiz. **Tiada pemisahan latar, rangka tangan, atau UI skor/nyawa Version 3.**

Permainan interaktif HTML/CSS/JavaScript bagi latihan menghubungkan nombor 1–3, 1–5 atau 1–10 dengan kuantiti objek. Direka dengan pilihan kawalan sentuhan/mouse, `Point & Select`, dan `Pinch & Drag` menggunakan MediaPipe Hand Landmarker.

## Mulakan

**Pilihan paling mudah:** terbitkan keseluruhan kandungan folder ini di GitHub Pages (pastikan `index.html`, `styles.css`, `game.js` berada di akar repositori). Buka alamat GitHub Pages menggunakan Chrome, Edge, atau Safari moden.

**Uji pada komputer:** jalankan `python -m http.server 8000` dalam folder ini, kemudian buka http://localhost:8000. Jangan gunakan `file://` bagi menguji kamera.

## Cara bermain

- **Misi 1 — Jom Kira:** kira buah dan pilih simbol nombor.
- **Misi 2 — Isi Bakul:** ambil buah dan masukkan ke bakul; permainan menyemak secara automatik apabila bilangan mencukupi. Pada skrin sentuh/mouse, ketik buah lalu bakul atau seret buah ke bakul. Dalam mod Point & Select, halakan jari 1.4 saat pada buah kemudian bakul. Dalam mod Pinch & Drag, cubit pada buah, gerakkan tangan, kemudian lepaskan di bakul. Jika gerakan sukar, pilih buah lalu cubit pada bakul.
- **Misi 3 — Padankan:** cari kumpulan buah yang sama bilangannya dengan simbol nombor.
- Jika webcam gagal, pilih mod **Sentuhan / mouse**. Semua misi boleh dilakukan tanpa webcam.
- Klik **⛶ Fullscreen game** di dalam kotak permainan untuk membesarkan permainan sahaja; gunakan kawalan keluar fullscreen pelayar atau `Esc` pada komputer untuk kembali. Sesetengah browser telefon menggunakan paparan imersif yang tidak semestinya menyembunyikan bar browser.

## Kamera dan internet

- Kamera memerlukan kebenaran pengguna dan persekitaran **HTTPS** atau **localhost**. Apabila aktif, video webcam menjadi **latar belakang penuh papan permainan** seperti gaya kuiz webcam; nombor, kad buah dan bakul berada di atas video. Ia **tidak** memotong latar video atau melukis rangka tangan.
- Modul MediaPipe `@mediapipe/tasks-vision@0.10.22-rc.20250304` (jsDelivr) dan model hand_landmarker (Google) dimuat turun ketika webcam diaktifkan. Maka, webcam memerlukan sambungan internet sekurang-kurangnya semasa muat turun pertama.
- Video webcam diproses di browser dan tidak disimpan atau dimuat naik **oleh kod permainan ini**. CDN/model luaran digunakan untuk muat turun pustaka/model sahaja. Elakkan menggunakan identiti sebenar murid.
- Fungsi webcam dan kadar bingkai bergantung pada peranti, browser, pencahayaan dan keizinan kamera. Uji pada peranti sasaran sebelum digunakan di kelas.
- `Point & Select` memerlukan tangan dikekalkan di atas sasaran selama 1.4 saat. `Pinch & Drag` menganggar gestur melalui jarak ibu jari dan telunjuk; jika tidak stabil, gunakan mod lain.

## Panduan guru

1. Pilih julat `1–3`, `1–5`, atau `1–10` berdasarkan penguasaan awal murid.
2. Mulakan dengan mod Sentuhan/mouse untuk mengesahkan murid faham tugasan, kemudian pilih mod webcam jika sesuai.
3. Gunakan butang **Tunjuk bantuan** apabila murid memerlukan petunjuk.
4. Bagi latihan sebenar, beri peluang murid membilang dan memadankan objek fizikal di kelas selepas bermain.
5. Klik **Eksport rekod CSV** bagi melihat tahapan, nombor sasaran, mod input, ketepatan cubaan pertama, bilangan kesilapan dan penggunaan bantuan. Data hanya disimpan dalam memori pelayar **sepanjang tab dibuka** dan dipadamkan apabila dimulakan semula/ditutup. Muat turun CSV sebelum meninggalkan halaman.
6. Tiada akaun, pengumpulan identiti atau markah kompetitif. Rekod ialah **data latihan**, bukan diagnosis atau bukti sebab-akibat.

## Asas akademik

- Cheng, D., et al. (2020). *Short-term numerosity training promotes symbolic arithmetic in children with developmental dyscalculia: The mediating role of visual form perception*. Developmental Science, 23(4), e12910. https://doi.org/10.1111/desc.12910
- Wilson, A. J., et al. (2006). *An open trial assessment of “The Number Race”, an adaptive computer game for remediation of dyscalculia*. Behavioral and Brain Functions, 2, 20. https://doi.org/10.1186/1744-9081-2-20
- CAST. (2024). *Universal Design for Learning Guidelines version 3.0*. https://udlguidelines.cast.org/
- MediaPipe: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js

**Penting:** Kajian di atas menyokong latihan nombor, bukan bukti bahawa MediaPipe lebih berkesan daripada input biasa. Profil murid projek ialah simulasi dan perlu dilabelkan sedemikian.

## Struktur fail

- `index.html` — struktur antaramuka
- `styles.css` — tema responsif
- `game.js` — logik permainan, rekod dan pengesanan MediaPipe

Kod ini ditulis khusus untuk tugasan permainan interaktif. Emoji sistem digunakan untuk objek buah dan tidak memerlukan fail imej tambahan.


Kemas kini terkini: fullscreen fokus pada ruang permainan sahaja; webcam dipaparkan sebaik diaktifkan; jawapan betul bergerak automatik ke soalan seterusnya; jawapan salah mengulang automatik soalan yang sama; pokok Misi 2 digayakan lebih kartun dan mesra MBPK.


## Kemasan Misi 2 untuk komputer riba / desktop
Pada skrin komputer dengan mouse/trackpad, pokok ditunjukkan di sebelah kiri dan bakul di sebelah kanan. Dalam paparan penuh, kedua-duanya kekal kelihatan. iPad dan telefon terus menggunakan susun atur menegak yang sudah disediakan. Buah kini berada pada kedudukan di atas rimbunan pokok, dengan saiz yang lebih jelas.
