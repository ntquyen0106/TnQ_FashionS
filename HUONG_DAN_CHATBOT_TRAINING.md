# 📚 HƯỚNG DẪN SỬ DỤNG - QUẢN LÝ TRAINING DATA CHATBOT

## 🎯 Mục đích

Trang này giúp bạn **dạy chatbot** các thông tin về shop để chatbot có thể **tự động trả lời khách hàng** một cách chính xác về:

- Chính sách vận chuyển
- Chính sách đổi trả
- Phương thức thanh toán
- Bảo hành sản phẩm
- Câu hỏi thường gặp (FAQ)
- Giới thiệu về shop

---

## 🚀 CÁCH SỬ DỤNG TỪNG BƯỚC

### **BƯỚC 1: Truy cập trang quản lý**

1. Đăng nhập với tài khoản **Admin**
2. Vào menu **Dashboard** > **Quản lý Chatbot**
3. Trang sẽ hiển thị giao diện quản lý Training Data

---

### **BƯỚC 2: Chọn loại dữ liệu muốn thêm**

Bạn sẽ thấy 6 nút ở phần trên:

```
📚 Tất cả    🚚 Vận chuyển    ↩️ Đổi trả    💳 Thanh toán    🛡️ Bảo hành    ❓ FAQ    ℹ️ Giới thiệu
```

**Ý nghĩa từng loại:**

| Loại              | Khi nào dùng            | Ví dụ                                             |
| ----------------- | ----------------------- | ------------------------------------------------- |
| 🚚 **Vận chuyển** | Thông tin về giao hàng  | "Giao hàng toàn quốc 2-3 ngày, miễn phí từ 500k"  |
| ↩️ **Đổi trả**    | Chính sách đổi trả hàng | "Đổi trả trong 7 ngày nếu sản phẩm lỗi"           |
| 💳 **Thanh toán** | Cách thức thanh toán    | "Hỗ trợ COD, chuyển khoản, ví điện tử"            |
| 🛡️ **Bảo hành**   | Chính sách bảo hành     | "Bảo hành 12 tháng với sản phẩm lỗi nhà sản xuất" |
| ❓ **FAQ**        | Câu hỏi thường gặp      | "Làm sao để đổi size giày?"                       |
| ℹ️ **Giới thiệu** | Thông tin về shop       | "Shop thành lập năm 2020, chuyên thời trang..."   |

**👉 Click vào loại dữ liệu bạn muốn thêm**

---

### **BƯỚC 3: Thêm dữ liệu mới**

1. **Click nút "➕ Thêm ..."** (ví dụ: "➕ Thêm Vận chuyển")

2. **Form sẽ hiện ra với các trường:**

   📂 **Loại dữ liệu** (đã chọn sẵn, không đổi được)

   📝 **Tiêu đề** \*

   - Đặt tên ngắn gọn để dễ quản lý
   - Ví dụ: "Giao hàng miễn phí toàn quốc"

   📄 **Nội dung chi tiết** \*

   - Viết đầy đủ thông tin mà chatbot sẽ dùng để trả lời
   - Ví dụ:

   ```
   Shop giao hàng toàn quốc với các chính sách sau:
   - Giao hàng trong 2-3 ngày làm việc
   - MIỄN PHÍ ship với đơn hàng từ 500.000đ
   - Thu hộ COD an toàn
   - Giao hàng tận nơi, kiểm tra trước khi nhận
   ```

   🔢 **Thứ tự hiển thị**

   - Số 0 sẽ hiển thị đầu tiên, 1 thứ hai, ...
   - Để 0 nếu quan trọng nhất

   ✅ **Kích hoạt ngay**

   - Tick ✅ nếu muốn chatbot dùng ngay
   - Bỏ tick nếu muốn lưu nháp

3. **Click "➕ Thêm mới"**

4. **Thành công!** Dữ liệu sẽ xuất hiện trong danh sách

---

### **BƯỚC 4: Quản lý dữ liệu đã thêm**

Mỗi dữ liệu sẽ hiển thị dưới dạng **thẻ card** với:

```
┌─────────────────────────────────────────────┐
│ Giao hàng miễn phí        🚚 Vận chuyển    │
├─────────────────────────────────────────────┤
│ Shop giao hàng toàn quốc với các chính...  │
│                                             │
│ 📊 Thứ tự: 0 | ✅ Đang hoạt động           │
│ 🕒 Cập nhật: 10/11/2025                    │
│                                             │
│ [✏️ Sửa] [⏸️ Tắt] [🗑️ Xóa]                │
└─────────────────────────────────────────────┘
```

**Các nút chức năng:**

| Nút                 | Chức năng          | Giải thích                                                       |
| ------------------- | ------------------ | ---------------------------------------------------------------- |
| **✏️ Sửa**          | Chỉnh sửa nội dung | Mở form để sửa tiêu đề, nội dung, thứ tự                         |
| **⏸️ Tắt / ▶️ Bật** | Bật/Tắt            | Tắt = chatbot không dùng để trả lời<br>Bật = chatbot có thể dùng |
| **🗑️ Xóa**          | Xóa vĩnh viễn      | ⚠️ Không thể hoàn tác!                                           |

---

### **BƯỚC 5: Sửa dữ liệu**

1. Click nút **✏️ Sửa** trên card
2. Form sẽ hiện ra với dữ liệu hiện tại
3. Chỉnh sửa nội dung cần thay đổi
4. Click **💾 Cập nhật**
5. ✅ Thành công!

**⚠️ Lưu ý:** Không thể đổi **loại dữ liệu** khi đang sửa

---

### **BƯỚC 6: Bật/Tắt dữ liệu**

**Khi nào cần tắt?**

- Thông tin tạm thời không còn hiệu lực (VD: khuyến mãi hết hạn)
- Muốn cập nhật lại sau
- Test thử nghiệm

**Cách làm:**

1. Click nút **⏸️ Tắt** hoặc **▶️ Bật**
2. Dữ liệu tắt sẽ hiển thị mờ hơn
3. Chatbot **KHÔNG** dùng dữ liệu đã tắt

---

### **BƯỚC 7: Xóa dữ liệu**

**⚠️ CẢNH BÁO: Hành động này không thể hoàn tác!**

1. Click nút **🗑️ Xóa**
2. Xác nhận trong popup: "Bạn chắc chắn muốn xóa ...?"
3. Click **OK** để xóa
4. Dữ liệu sẽ bị xóa vĩnh viễn

**💡 Khuyến nghị:** Nên dùng **Tắt** thay vì **Xóa** để giữ lại dữ liệu

---

## 📖 VÍ DỤ THỰC TẾ

### **Ví dụ 1: Thêm chính sách vận chuyển**

1. Click nút **🚚 Vận chuyển**
2. Click **➕ Thêm Vận chuyển**
3. Điền form:

   ```
   Loại: 🚚 Vận chuyển (đã chọn sẵn)
   Tiêu đề: Chính sách giao hàng toàn quốc

   Nội dung:
   TnQ Fashion giao hàng toàn quốc với các ưu đãi:
   - Giao hàng trong 2-3 ngày làm việc
   - MIỄN PHÍ ship với đơn từ 500.000đ
   - Thu hộ COD (thanh toán khi nhận hàng)
   - Được kiểm tra sản phẩm trước khi thanh toán
   - Đổi size miễn phí trong vòng 7 ngày

   Hotline hỗ trợ: 1900-xxxx

   Thứ tự: 0
   ✅ Kích hoạt ngay
   ```

4. Click **➕ Thêm mới**

**Kết quả:** Khi khách hỏi "Shop giao hàng như thế nào?", chatbot sẽ trả lời dựa trên nội dung này.

---

### **Ví dụ 2: Thêm FAQ**

1. Click nút **❓ Câu hỏi thường gặp**
2. Click **➕ Thêm Câu hỏi thường gặp**
3. Điền form:

   ```
   Loại: ❓ FAQ
   Tiêu đề: Làm sao để đổi size giày?

   Nội dung:
   Nếu size giày không vừa, quý khách có thể đổi size theo quy trình:

   1. Liên hệ shop qua hotline 1900-xxxx hoặc chat
   2. Gửi lại sản phẩm (chưa qua sử dụng, còn nguyên tem)
   3. Shop sẽ gửi size mới cho bạn MIỄN PHÍ
   4. Thời gian đổi: 3-5 ngày

   Lưu ý: Sản phẩm phải còn nguyên vẹn, chưa giặt, chưa qua sử dụng

   Thứ tự: 5
   ✅ Kích hoạt ngay
   ```

---

### **Ví dụ 3: Thêm chính sách đổi trả**

1. Click **↩️ Đổi trả**
2. Click **➕ Thêm Đổi trả**
3. Điền:

   ```
   Tiêu đề: Chính sách đổi trả 7 ngày

   Nội dung:
   TnQ Fashion hỗ trợ đổi trả trong vòng 7 ngày kể từ khi nhận hàng:

   ✅ Được đổi trả:
   - Sản phẩm lỗi do nhà sản xuất
   - Giao sai size, sai màu
   - Sản phẩm không giống mô tả

   ❌ Không được đổi trả:
   - Sản phẩm đã qua sử dụng
   - Sản phẩm đã giặt, bị bẩn
   - Hết thời hạn 7 ngày
   - Sản phẩm sale, khuyến mãi

   Quy trình đổi trả: Liên hệ hotline > Gửi hàng về > Nhận hàng mới/hoàn tiền
   ```

---

## 💡 MẸO SỬ DỤNG HIỆU QUẢ

### ✅ **NÊN:**

1. **Viết đầy đủ, chi tiết**
   - Chatbot càng có nhiều thông tin càng trả lời tốt
2. **Dùng danh sách đánh số/bullet points**
   ```
   - Mục 1
   - Mục 2
   - Mục 3
   ```
3. **Thêm số điện thoại, link liên hệ**
   - Để khách có thể liên hệ nếu cần
4. **Cập nhật thường xuyên**
   - Khi có chính sách mới, sửa ngay
5. **Sắp xếp thứ tự hợp lý**
   - Thông tin quan trọng đặt order = 0
   - Thông tin phụ đặt order = 1, 2, 3...

### ❌ **KHÔNG NÊN:**

1. ❌ Viết quá ngắn, thiếu thông tin
2. ❌ Dùng từ ngữ khó hiểu, chuyên ngành
3. ❌ Thêm thông tin sai, lỗi thời
4. ❌ Để nhiều dữ liệu trùng lặp
5. ❌ Quên tắt dữ liệu khi hết hiệu lực

---

## 🔍 FILTER VÀ TÌM KIẾM

### **Xem tất cả dữ liệu**

- Click nút **📚 Tất cả**
- Xem toàn bộ dữ liệu training

### **Lọc theo loại**

- Click vào loại cụ thể (🚚, ↩️, 💳, ...)
- Chỉ hiển thị dữ liệu của loại đó

### **Đếm số lượng**

- Con số trong badge (ví dụ: 🚚 Vận chuyển **5**)
- Cho biết có bao nhiêu mục dữ liệu

---

## 🎨 HIỂU GIAO DIỆN

### **Màu sắc ý nghĩa:**

| Màu           | Ý nghĩa                 |
| ------------- | ----------------------- |
| ✅ Xanh lá    | Đang hoạt động (Active) |
| ⏸️ Xám        | Đã tắt (Inactive)       |
| 🔵 Xanh dương | Nút chỉnh sửa           |
| 🟡 Vàng       | Nút bật/tắt             |
| 🔴 Đỏ         | Nút xóa (nguy hiểm!)    |

### **Trạng thái card:**

- **Card sáng, rõ nét** = Đang hoạt động
- **Card mờ, nền xám** = Đã tắt

---

## 🛠️ XỬ LÝ LỖI

### **Lỗi: "Không thể tải dữ liệu"**

✅ **Giải pháp:**

1. Kiểm tra kết nối internet
2. Refresh lại trang (F5)
3. Đăng xuất > Đăng nhập lại

### **Lỗi: "Không thể lưu"**

✅ **Giải pháp:**

1. Kiểm tra đã điền đủ Tiêu đề và Nội dung chưa
2. Nội dung không được để trống
3. Thử lại sau vài giây

### **Lỗi: "Không có quyền xóa"**

✅ **Giải pháp:**

- Chỉ **Admin** mới xóa được
- Nếu bạn là Staff, chỉ có thể Sửa và Tắt

---

## 📊 QUY TRÌNH LÀM VIỆC KHUYẾN NGHỊ

### **Ban đầu (Setup lần đầu):**

1. ✅ Thêm 2-3 dữ liệu **🚚 Vận chuyển**
2. ✅ Thêm 2-3 dữ liệu **↩️ Đổi trả**
3. ✅ Thêm 2-3 dữ liệu **💳 Thanh toán**
4. ✅ Thêm 5-10 **❓ FAQ** phổ biến
5. ✅ Thêm 1 dữ liệu **ℹ️ Giới thiệu shop**

### **Hàng tuần:**

1. 🔍 Kiểm tra các câu hỏi khách thường hỏi
2. ➕ Thêm FAQ mới nếu có câu hỏi lặp lại nhiều
3. ✏️ Cập nhật nội dung nếu có thay đổi

### **Khi có khuyến mãi:**

1. ➕ Thêm dữ liệu mới về chương trình khuyến mãi
2. ⏸️ Tắt dữ liệu khi hết khuyến mãi
3. 🗑️ Xóa sau 1 tháng (nếu cần)

---

## ❓ CÂU HỎI THƯỜNG GẶP

### **Q: Thêm bao nhiêu dữ liệu là đủ?**

A: Ít nhất:

- 2-3 mục mỗi loại (Vận chuyển, Đổi trả, Thanh toán, Bảo hành)
- 10-20 FAQ
- 1 giới thiệu shop

### **Q: Chatbot sẽ trả lời như thế nào?**

A: Chatbot sẽ:

1. Phân tích câu hỏi của khách
2. Tìm dữ liệu training phù hợp nhất
3. Trả lời dựa trên nội dung bạn đã thêm

### **Q: Tôi sửa dữ liệu, chatbot có cập nhật ngay không?**

A: **CÓ!** Chatbot sẽ dùng dữ liệu mới nhất để trả lời ngay lập tức.

### **Q: Tôi có thể xóa dữ liệu đã thêm không?**

A:

- **Admin**: Có thể xóa
- **Staff**: Không thể xóa, chỉ có thể Tắt

### **Q: Nên để thứ tự như thế nào?**

A:

- **0**: Thông tin quan trọng nhất, chatbot ưu tiên trả lời
- **1, 2, 3...**: Thông tin bổ sung

### **Q: Tắt và Xóa khác nhau như thế nào?**

A:

- **Tắt (⏸️)**: Dữ liệu vẫn còn, có thể bật lại
- **Xóa (🗑️)**: Xóa vĩnh viễn, không khôi phục được

---

## 📞 HỖ TRỢ

Nếu gặp khó khăn, liên hệ:

- **IT Support**: [email/phone]
- **Admin hệ thống**: [email/phone]

---

## 🎉 KẾT LUẬN

Việc thêm và quản lý Training Data giúp:

- ✅ Chatbot trả lời chính xác hơn
- ✅ Giảm tải công việc cho nhân viên
- ✅ Khách hàng hài lòng hơn
- ✅ Tăng hiệu quả kinh doanh

**💡 Hãy cập nhật thường xuyên để chatbot ngày càng thông minh hơn!**

---

📅 **Ngày cập nhật:** 10/11/2025  
📝 **Version:** 1.0
