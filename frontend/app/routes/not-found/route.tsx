import { ErrorView } from "~/components/error-view";

export default function NotFound() {
    return (
        <ErrorView
            code="404"
            title="Page Not Found"
            message="Halaman yang Anda cari tidak ditemukan atau telah dipindahkan. Pastikan URL yang Anda masukkan sudah benar."
            type="not-found"
        />
    );
}
