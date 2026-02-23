import { ErrorView } from "~/components/error-view";

export default function Unauthorized() {
    return (
        <ErrorView
            code="401"
            title="Access Denied"
            message="Maaf, Anda belum login atau tidak memiliki akses ke halaman ini. Silakan login terlebih dahulu untuk melanjutkan ke Dashboard."
            type="unauthorized"
        />
    );
}
