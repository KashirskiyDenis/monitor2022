const express = require('express');
const http = require('http');
const path = require('path');
const config = require('config');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');
const mysql = require('mysql');
const WebSocket = require('ws');
const events = require('events');

const app = express();
const server = http.createServer(app);

app.set('port', config.get('port'));
app.engine('ejs', require('ejs-locals'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(cookieParser());
app.use(bodyParser());
// app.use(app.router);

app.use(express.static(path.join(__dirname, 'public')));

server.listen(app.get('port'), () => {
    console.log('Express server on port ' + config.get('port'));
    firstLoad();
});

const wss = new WebSocket.Server({ server });
const eventEmitter = new events.EventEmitter();

let clients = {};
let stateObjects = {};
let stateParameter = {};

wss.on('connection', ws => {
    let idWS = Date.now().toString() + '' + Math.random().toString().substr(2);
    clients[idWS] = ws;

    ws.on('close', () => {
        delete clients[idWS];
    });
});

eventEmitter.on('data', () => {
    for (let key in clients) {
        if (clients[key].readyState === clients[key].OPEN)
            clients[key].send(JSON.stringify(stateParameter));
    }
});

function dbQuery(sql) {
    const connection = mysql.createConnection(config.get('mysql'));
    return new Promise((resolve, reject) => {
        connection.query(sql, (err, result) => {
            if (err)
                reject(err);

            resolve(result);
            connection.end();
        });
    });
}

function firstLoad() {
    const sql = `SELECT objectTitle, parameterName, value, date
        FROM (
            SELECT *,
            RANK() OVER (PARTITION BY objectTitle, parameterName ORDER BY objectTitle, parameterName, date DESC) rak
            FROM log
        ) rank_params
        WHERE rak = 1`;
    dbQuery(sql)
        .then(result => {
            for (let i = 0; i < result.length; i++) {
                if (stateObjects[result[i].objectTitle] == undefined)
                    stateObjects[result[i].objectTitle] = { parameters: [] };

                let temp = {
                    parameterName: result[i].parameterName,
                    value: result[i].value,
                    date: result[i].date.toISOString().slice(0, 19).replace('T', ' ')
                };

                stateObjects[result[i].objectTitle].parameters.push(temp);
            }
        })
        .catch(error => {
            next(error);
        });
}

// Middleware
app.get('/', (req, res, next) => {
    let params = {};
    params['stateObjects'] = stateObjects;
    res.render('index', params);
});

app.get('/object/:obj/parameter/:param', (req, res, next) => {
    let sql = `SELECT value, date
        FROM log
        WHERE objectTitle = '${req.params.obj}' AND 
            parameterName = '${req.params.param}' AND
            date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
        ORDER BY date DESC`;
    dbQuery(sql)
        .then(result => {
            res.render('object', {
                result: result,
                object: req.params.obj,
                parameter: req.params.param
            });
        })
        .catch(error => {
            next(error);
        });
});

app.post('/api', (req, res, next) => {
    const date = new Date().toLocaleString('ru-RU', {
        timeZone: 'Europe/Astrakhan'
    });

    const sql = `INSERT INTO log (objectTitle, parameterName, value, date)
            VALUES ('${req.body['objectName']}', '${req.body['parameterName']}', '${req.body['value']}', '${date}')`;

    dbQuery(sql)
        .then(result => {
            for (parameter of stateObjects[req.body['objectName']].parameters) {
                if (parameter.parameterName == req.body['parameterName']) {
                    parameter.value = req.body['value'];
                    parameter.date = date;
                }
            }

            stateParameter = req.body;
            stateParameter.date = date;
            eventEmitter.emit('data');
            res.end('End');
        })
        .catch(error => {
            next(error);
        });
});

app.get('/api/object/:obj/parameter/:param', (req, res) => {
    const sql = `SELECT value, date
        FROM log
        WHERE objectTitle = '${req.params.obj}' AND 
            parameterName = '${req.params.param}' AND
            date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
        ORDER BY date DESC`;
    dbQuery(sql)
        .then(result => {
            res.json(result);
        })
        .catch(error => {
            next(error);
        });
});

app.get('/api/object/:obj/parameter/:param/time/:time', (req, res, next) => {
    const sql = `SELECT value, date
        FROM log
        WHERE objectTitle = '${req.params.obj}' AND 
            parameterName = '${req.params.param}' AND
            date >= DATE_SUB(CURRENT_DATE, INTERVAL ${req.params.time} DAY)
        ORDER BY date DESC`;
    dbQuery(sql)
        .then(result => {
            res.json(result);
        })
        .catch(error => {
            next(error);
        });
});

app.use((req, res, next) => {
    if (req.url == '/error')
        next(new Error('Wops'));
    else
        next();
});

app.use((req, res) => {
    res.status(404).end('Error 404 Page not found');
});

app.use((err, req, res, next) => {
    if (app.get('env') == 'development')
        res.end(err.toString());
    else
        res.send(500);
});