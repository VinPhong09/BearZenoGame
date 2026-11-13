# BearZeno Games – Landing page

Static site (HTML/CSS/JS, no build) listing our Google Play games, plus `app-ads.txt` for AdMob verification.

## Trang admin – thêm / sửa game

Mở `https://<site>/admin/`. Trang admin đọc và ghi trực tiếp vào repo GitHub qua GitHub API,
sau đó GitHub Pages tự deploy lại (1–2 phút). Không cần server.

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

1. Mở `app-ads.txt` (hoặc tab *app-ads.txt* trong admin), thay `pub-0000000000000000` bằng Publisher ID AdMob của bạn (AdMob → Settings → Account information). Nếu dùng thêm mạng quảng cáo khác (mediation), thêm dòng của từng mạng vào file.
2. Trong **Google Play Console**, mỗi app → *Store presence → Store settings → Contact details → Website* phải là **đúng domain gốc** của site này (ví dụ `https://bearzeno.com` hoặc `https://vinphong09.github.io`).
3. File phải truy cập được tại `https://<domain>/app-ads.txt` — **ở gốc domain, không nằm trong thư mục con**.
4. AdMob → Apps → *app-ads.txt* → bấm *Check for updates*. Việc crawl có thể mất tới 24h.

### Lưu ý khi dùng GitHub Pages

AdMob chỉ đọc `app-ads.txt` ở **gốc domain**. Repo `BearZenoGame` mặc định sẽ được deploy ở
`https://vinphong09.github.io/BearZenoGame/` → file nằm ở `/BearZenoGame/app-ads.txt`, **AdMob sẽ không thấy**.

Chọn một trong hai cách:

- **Custom domain (khuyên dùng):** mua domain (vd `bearzeno.com`), tạo file `CNAME` chứa tên domain, trỏ DNS về GitHub Pages. Khi đó file nằm ở `https://bearzeno.com/app-ads.txt`.
- **Repo user site:** đổi tên repo thành `VinPhong09.github.io`, site sẽ ở `https://vinphong09.github.io/` và file ở `https://vinphong09.github.io/app-ads.txt`.

### Bật GitHub Pages

Repo → *Settings → Pages* → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)`.

## Chạy thử local

```bash
python -m http.server 8080
```

Mở http://localhost:8080
