document.addEventListener('alpine:init', () => {
    Alpine.data('dateExample', () => {
        // Keep picker instances outside Alpine's reactive proxy.
        let singlePicker;
        let rangePicker;
        let disposed = false;
        return {
            date: '',
            from: '',
            to: '',
            init() {
                this.$nextTick(() => {
                    if (disposed) return;
                    singlePicker = new JWheelPicker({ target: this.$refs.appointment });
                    rangePicker = new JalaliWheelRangePicker({ from: this.$refs.from, to: this.$refs.to });
                });
            },
            destroy() {
                disposed = true;
                singlePicker?.destroy();
                rangePicker?.destroy();
            }
        };
    });
});
