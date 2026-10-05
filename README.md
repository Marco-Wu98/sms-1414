# Đối chiếu SMS 1414

Ứng dụng Next.js nội bộ để đọc PDF SMS, đối chiếu số di động Việt Nam với Excel/CSV và overlay `STT: <giá trị Excel>` lên các trang đã khớp.

## Phân tích hai file mẫu

- **Excel**: sheet dữ liệu là `Sheet3`, có 14 bản ghi. Header STT là `TT/No`, số điện thoại là `Số điện thoại/ Telephone`, tên là `Họ và tên / Full name`, CCCD là `Số Giấy tờ tùy thân / ID number`. Cả 14 SĐT mẫu đều là số di động Việt Nam 10 chữ số, không có số trùng. Sheet `Sheet2` chứa một danh sách nhỏ không liên quan đến mapping này. MVP đọc sheet đầu tiên và cho phép đổi mapping STT, SĐT, CCCD và họ tên trong giao diện.
- **PDF**: 191 trang A4 ảnh chụp màn hình, không có text layer. Vì vậy toàn bộ trang được render tuần tự và OCR cục bộ bằng Tesseract tiếng Việt. Thử OCR hai trang mẫu cho thấy trang giao diện tối bỏ sót một SĐT màu link trong lần đọc toàn trang; một lượt crop/phóng to phần hội thoại với whitelist chữ số đã nhận diện được `0559322733`. Ứng dụng dùng cả hai lượt đọc; chỉ tự gán khi có duy nhất một số khớp Excel, còn trường hợp mơ hồ cần duyệt thủ công.
- PDF mẫu được tạo ngày 08/09/2026 theo metadata; mẫu không bị sửa trong quá trình phân tích.

## Chạy local

Yêu cầu Node.js 20.9+ và npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Mở `http://localhost:3000`. Chọn PDF, chọn Excel/CSV, xác nhận mapping STT/SĐT/CCCD (và tên nếu cần), rồi bấm **Đối chiếu và đánh STT**. Mọi trang được đọc tuần tự để giới hạn RAM. App ưu tiên khớp SĐT chính xác; khi không có SĐT khớp mới tra CCCD 12 số. Kết quả cần xem lại có thể nhập SĐT hoặc CCCD và xác nhận trước khi xuất.

Lần đầu OCR cần tải worker PDF.js và dữ liệu ngôn ngữ Tesseract từ CDN được cấu hình. PDF, Excel và nội dung OCR không được gửi lên server; nếu môi trường không có mạng ở lần đầu, cần phục vụ sẵn worker và `vie.traineddata` nội bộ, rồi đặt `NEXT_PUBLIC_TESSERACT_LANG_PATH` tới thư mục dữ liệu đó. Parser XLSX theo yêu cầu SheetJS Community (`xlsx@0.18.5`); `npm audit --omit=dev` còn 1 finding mức cao bao gồm hai advisory của package này, chưa có bản vá công khai. Chỉ dùng file Excel đáng tin cậy cho đến khi có bản SheetJS đã vá.

## Xử lý và quyền riêng tư

- PDF được đọc bằng PDF.js: lấy text layer trước; nếu cần OCR, đọc toàn trang rồi đọc thêm một crop phóng to vùng hội thoại trung tâm với whitelist số để tăng độ nhạy với chữ nhỏ/link màu.
- OCR chỉ chạy một trang tại một thời điểm; canvas được giải phóng sau khi xử lý.
- Chuẩn hóa chỉ thay cách viết/đầu mã quốc gia, không sửa chữ số. Chỉ nhận số di động Việt Nam 10 số, đầu 03/05/07/08/09; 1414 và mã dài hơn bị loại.
- Tạo bản đồ tra cứu SĐT và CCCD một lần trước khi đọc trang. SĐT khớp được ưu tiên; CCCD chỉ là khóa dự phòng khi không có SĐT khớp. CCCD phải đủ chính xác 12 chữ số, không dùng sửa lỗi gần đúng.
- Nếu có đúng một kết quả duy nhất theo khóa đang dùng thì lấy nguyên STT từ dòng Excel. Nhiều SĐT/CCCD khớp hoặc khóa trùng trong Excel sẽ cần duyệt thủ công.
- Khi xuất, pdf-lib mở PDF gốc và vẽ lên trang tương ứng. Mọi trang, thứ tự và kích thước được giữ nguyên; trang chưa khớp vẫn có mặt nhưng không được thêm STT.
- Giới hạn upload: PDF 80 MB, Excel 20 MB. Tệp không được gửi đến API của ứng dụng.

## Kiểm thử và triển khai

```bash
npm test
npm run build
```

Docker:

```bash
docker build -t sms-stt-matcher .
docker run --rm -p 3000:3000 sms-stt-matcher
```

Docker dùng chế độ standalone của Next.js.

## Cấu trúc chính

```text
app/                 UI Next.js App Router
lib/excel/           Nhập XLSX/XLS/CSV và map cột
lib/phone/           Chuẩn hóa, lọc số di động
lib/matching/        Match chính xác, manual confirm, duplicate handling
lib/pdf/             Đọc/OCR PDF và overlay đầu ra
types/               Employee, page result, progress
tests/               Unit tests cho phone, matching, PDF output
```
