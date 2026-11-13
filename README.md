# BearZeno Games – Landing page

Static site (HTML/CSS/JS, no build) listing our Google Play games, plus `app-ads.txt` for AdMob verification.

## Trang admin – thêm / sửa game

Mở <https://www.bearzenogames.com/admin/>. Trang admin đọc và ghi trực tiếp vào repo GitHub qua GitHub API,
sau đó Vercel tự deploy lại (~1 phút). Không cần server.

1. Tạo **fine-grained token**: <https://github.com/settings/personal-access-tokens/new>
   - Repository access: *Only select repositories* → chọn repo này
   - Repository permissions → **Contents: Read and write**
2. Vào tab **Kết nối GitHub**, kiểm tra owner / repo / branch, dán token → *Kết nối*.
3. Tab **Games**: thêm, sửa, xoá, sắp xếp, chọn game nổi bật, upload icon (tự cắt vuông 512×512).
   Ô package có thể dán thẳng link Google Play.
4. Tab **Studio**: tên, giới thiệu, link developer, email.
5. Tab **app-ads.txt**: sửa file và tự kiểm tra định dạng / publisher ID.
6. Bấm **Publish** — mỗi lần publish là một commit vào repo.

Token chỉ lưu trên trình duyệt của bạn (chỉ giữ lại khi tick "Ghi nhớ") và chỉ gửi tới `api.github.com`.
Ai mở được `/admin/` mà không có token thì chỉ xem được, không sửa được.

### Sửa tay (không dùng admin)

Dữ liệu nằm ở **`games.json`**:

- `studio` – tên studio, mô tả, link trang developer trên Google Play, email liên hệ.
- `games` – mỗi game một object:
  - `id`: package name (phần sau `?id=` trong link Play Store)
  - `name`, `genre`, `tagline`
  - `icon`: đường dẫn ảnh trong `assets/games/`. Để `""` sẽ hiện icon chữ cái tạm.
  - `featured: true` để game đó hiện ở khung nổi bật đầu trang.

Nút lọc theo thể loại tự xuất hiện khi có từ 2 `genre` khác nhau trở lên.

## app-ads.txt

Site deploy trên **Vercel** với domain `bearzenogames.com` (`bearzenogames.com` tự chuyển sang `www`).
Link xác minh: <https://www.bearzenogames.com/app-ads.txt>

1. Sửa `app-ads.txt` (hoặc tab *app-ads.txt* trong admin). Nếu dùng thêm mạng quảng cáo khác (mediation), thêm dòng của từng mạng vào file.
2. Trong **Google Play Console**, mỗi app → *Store presence → Store settings → Contact details → Website* = `https://www.bearzenogames.com`.
3. AdMob → Apps → *app-ads.txt* → bấm *Check for updates*. Việc crawl có thể mất tới 24h.

AdMob chỉ đọc `app-ads.txt` ở **gốc domain**, không đọc trong thư mục con.

## Chạy thử local

```bash
python -m http.server 8080
```

Mở http://localhost:8080
