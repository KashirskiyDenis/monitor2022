document.addEventListener('DOMContentLoaded', function () {
	let ajax = (type, url) => {
		let promise = new Promise(function (resolve, reject) {
			let request = new XMLHttpRequest();

			request.open(type, url, true);

			request.send();

			request.onload = function () {
				if (this.status === 200) {
					resolve(this.response);
				} else {
					let error = new Error(this.statusText);
					error.code = this.status;
					reject(error);
				}
			};

			request.onerror = function () {
				reject(new Error("Network error"));
			};
		});

		return promise;
	};

	let options = {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		weekday: 'long',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric'
	};

	function getGraphics(canvas) {
		let ctx = canvas.getContext("2d");
		let value = canvas.nextElementSibling;
		let date = canvas.nextElementSibling.nextElementSibling;

		const object = canvas.dataset.object;
		const parameter = canvas.dataset.parameter;
		const time = canvas.dataset.time;

		ajax("GET", `/api/object/${object}/parameter/${parameter}/time/${time}`).then(response => {
			response = JSON.parse(response);

			if (response.length == 0)
				return;
				
			ctx.clearRect(0, 0, 800, 150);
			ctx.strokeStyle = "rgba(0, 0, 255, 1.0)";

			ctx.moveTo(0, 150 / 2);
			ctx.beginPath();

			let dateBegin = new Date(response[response.length - 1].date);
			let dateEnd = new Date(response[0].date);

			date.children[0].innerHTML = `${dateBegin.toLocaleString("ru", options)}`;
			date.children[1].innerHTML = `${dateEnd.toLocaleString("ru", options)}`;

			let length = response.length;
			for (let i = 0; i < length; i++) {
				let x = 800 - i * (800 / length);
				let y = Number.parseFloat(response[i].value);

				y = y === 1 ? 150 / 2 : 150;

				ctx.lineTo(x, y);
			}

			ctx.stroke();

			value.children[0].innerHTML = 'Есть сигнала';
			value.children[1].innerHTML = 'Нет сигнал';
		}).catch(error => {
			alert(error);
		});
	}

	let canvases = document.getElementsByTagName("canvas");
	for (canvas of canvases)
		getGraphics(canvas);
});