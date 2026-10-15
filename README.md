# MISI BAKUL NOMBOR — Gaya Version 1 + Webcam Latar + Fullscreen Game

Versi ini mengekalkan reka bentuk asal Version 1, dengan sasaran nombor, buah dan bakul yang lebih besar. Dalam mod webcam, video kamera (termasuk tangan dan latar sebenar) memenuhi bahagian belakang permainan seperti contoh webcam quiz. **Tiada pemisahan latar, rangka tangan, atau UI skor/nyawa Version 3.**

Permainan interaktif HTML/CSS/JavaScript bagi latihan menghubungkan nombor 1–5 dengan kuantiti objek. Direka dengan pilihan kawalan sentuhan/mouse, `Point & Select`, dan `Pinch & Drag` menggunakan MediaPipe Hand Landmarker.

## Mulakan

**Pilihan paling mudah:** terbitkan keseluruhan kandungan folder ini di GitHub Pages (pastikan `index.html`, `styles.css`, `game.js` berada di akar repositori). Buka alamat GitHub Pages menggunakan Chrome, Edge, atau Safari moden.

**Uji pada komputer:** jalankan `python -m http.server 8000` dalam folder ini, kemudian buka http://localhost:8000. Jangan gunakan `file://` bagi menguji kamera.

## Cara bermain

- **Misi 1 — Jom Kira:** kira buah dan pilih simbol nombor.
- **Misi 2 — Isi Bakul:** ambil buah dan masukkan ke bakul; tekan **Semak bakul**. Pada skrin sentuh/mouse, ketik buah lalu bakul atau seret buah ke bakul. Dalam mod Point & Select, halakan jari 1.4 saat pada buah kemudian bakul. Dalam mod Pinch & Drag, cubit pada buah, gerakkan tangan, kemudian lepaskan di bakul. Jika gerakan sukar, pilih buah lalu cubit pada bakul.
- **Misi 3 — Padankan:** cari kumpulan buah yang sama bilangannya dengan simbol nombor.
- Jika webcam gagal, pilih mod **Sentuhan / mouse**. Semua misi boleh dilakukan tanpa webcam.
- Klik **⛶ Fullscreen game** di dalam kotak permainan untuk membesarkan permainan sahaja; tekan **✕ Keluar fullscreen** atau `Esc` untuk kembali. Sesetengah browser telefon menggunakan paparan imersif yang tidak semestinya menyembunyikan bar browser.

## Kamera dan internet

- Kamera memerlukan kebenaran pengguna dan persekitaran **HTTPS** atau **localhost**. Apabila aktif, video webcam menjadi **latar belakang penuh papan permainan** seperti gaya kuiz webcam; nombor, kad buah dan bakul berada di atas video. Ia **tidak** memotong latar video atau melukis rangka tangan.
- Modul MediaPipe `@mediapipe/tasks-vision@0.10.22-rc.20250304` (jsDelivr) dan model hand_landmarker (Google) dimuat turun ketika webcam diaktifkan. Maka, webcam memerlukan sambungan internet sekurang-kurangnya semasa muat turun pertama.
- Video webcam diproses di browser dan tidak disimpan atau dimuat naik **oleh kod permainan ini**. CDN/model luaran digunakan untuk muat turun pustaka/model sahaja. Elakkan menggunakan identiti sebenar murid.
- Fungsi webcam dan kadar bingkai bergantung pada peranti, browser, pencahayaan dan keizinan kamera. Uji pada peranti sasaran sebelum digunakan di kelas.
- `Point & Select` memerlukan tangan dikekalkan di atas sasaran selama 1.4 saat. `Pinch & Drag` menganggar gestur melalui jarak ibu jari dan telunjuk; jika tidak stabil, gunakan mod lain.

## Panduan guru

1. Pilih julat `1–3` atau `1–5` berdasarkan penguasaan awal murid.
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


### Kemas kini Misi 2 — Master v1.16
- Pada iPad/laptop dengan kawasan permainan yang cukup lebar, pokok berada di kiri dan bakul terbuka di kanan.
- Bakul tidak mempunyai kotak berbingkai. Bahagian dalam bakul dan bilangan buah yang dimasukkan kelihatan, sehingga 10 buah.
- Pada telefon sempit, pokok berada di atas dan bakul di bawah supaya kedua-duanya boleh dipilih dengan selesa.
- Logik Misi 1–3, julat 1–3/1–5/1–10, webcam dan confetti tidak diubah.
- Untuk GitHub Pages, muat naik semua lima fail (index.html, styles.css, game.js, tree-cartoon.svg, README.md) ke folder root repo dan gantikan fail lama. URL CSS/JS mempunyai versi ?v=116 untuk mengurangkan isu cache.


## Penambahbaikan Misi 3 (v1.17)

- Padankan nombor di sebelah kiri dengan kumpulan buah di sebelah kanan. Murid memilih satu nombor, kemudian kumpulan buah untuk menyambungkan garisan; tiada drag & drop diperlukan.
- Garisan **hijau** kekal selepas betul, garisan **merah** hanya muncul sebentar selepas salah.
- Julat **1–3**: satu set 3 pasangan; **1–5**: satu set 5 pasangan; **1–10**: dua set 5 pasangan, merangkumi semua nombor 1 hingga 10 tanpa pengulangan dalam misi.
- Boleh dimainkan dengan sentuhan, mouse, papan kekunci, Point & Select dan Pinch & Drag (gestur memilih dua sasaran).
- Misi 1, Misi 2, webcam, fullscreen, bakul dan ciri sedia ada kekal daripada master v1.16.
