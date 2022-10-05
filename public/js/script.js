let socket = new WebSocket('ws://10.130.32.75:3000');

socket.onmessage = function (event) {
    const message = JSON.parse(event.data);
    let parameter = document.getElementById(`${message.objectName}`).querySelector(`#${message.parameterName}`);

    if (message.value == 1) {
        if (parameter.classList.contains('warning'))
            parameter.classList.remove('warning');
    } else {
        if (!parameter.classList.contains('warning'))
            parameter.classList.add('warning');
    }

    parameter.querySelectorAll('p')[1].innerHTML = message.date;
};