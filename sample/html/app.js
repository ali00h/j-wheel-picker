const singlePicker = new JWheelPicker({
    target: '#date',
    onSelect(date) {
        document.querySelector('#single-result').textContent = `Selected: ${date.formatted}`;
    }
});

const rangePicker = new JalaliWheelRangePicker({
    from: '#from',
    to: '#to',
    onSelect({ from, to, complete }) {
        document.querySelector('#range-result').textContent = complete
            ? `${from.formatted} → ${to.formatted}`
            : 'Choose the other date to complete the range.';
    }
});

document.querySelector('#clear').addEventListener('click', () => {
    for (const id of ['#from', '#to']) {
        const input = document.querySelector(id);
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.querySelector('#range-result').textContent = 'Choose both dates (same-day ranges are allowed).';
});
