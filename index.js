// Подключение всех модулей к программе
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var bodyParser = require('body-parser');
var md5 = require('md5');
const fs = require('fs');
app.use(require('express').static(__dirname + '/'));
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var mysql = require('mysql');
// Отслеживание порта
server.listen(80);

//Подключение к базе даных
var connection = mysql.createConnection({
	host     : 'localhost',
	user     : 'root',
	password : '',
	database : 'chat'
});
connection.connect();
fs.readdirSync('./').forEach(file => {
	app.get(file, function(request, respons) {
		respons.sendFile(__dirname + '/'+file);
	});
})

// Отслеживание главной
app.get('/', function(request, respons) {
	respons.sendFile(__dirname + '/index.html');
	respons.sendFile(__dirname + '/chat/style.css');
});
// Отслеживание админ авторизации
app.get('/adminAuth', function(request, respons) {
	respons.sendFile(__dirname + '/chat/adminAuth.html');
});
// Отслеживание админ настроек
app.get('/adminSettings', function(request, respons) {
	if(request.headers.cookie != undefined && request.headers.cookie != "" && request.headers.cookie != null){
		matches = request.headers.cookie.match(new RegExp(
			"(?:^|; )" + "password".replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
		));
		if(matches){
			if(decodeURIComponent(matches[1]) != "6se3f9fD36uFMLL"){
				respons.redirect('/adminAuth');
			}
		}else{
			respons.redirect('/adminAuth');	
		}
	}else{
		respons.redirect('/adminAuth');
	}
	respons.sendFile(__dirname + '/chat/adminSettings.html');
});
// Отслеживание админ панели
app.get('/adminPanel', function(request, respons) {
	if(request.headers.cookie != undefined && request.headers.cookie != "" && request.headers.cookie != null){
		matches = request.headers.cookie.match(new RegExp(
			"(?:^|; )" + "password".replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
		));
		if(matches){
			if(decodeURIComponent(matches[1]) == "6se3f9fD36uFMLL"){
				respons.sendFile(__dirname + '/chat/adminPanel.html');
			}else{
				respons.redirect('/adminAuth');
			}
		}else{
			respons.redirect('/adminAuth');	
		}
	}else{
		respons.redirect('/adminAuth');
	}
});
connections = []; //подключенные

//Подключение
io.sockets.on('connection', function(socket) {
	// Добавление нового соединения в массив
	connections.push(socket);
	//Обновление юзеров
	var today = new Date().toLocaleString();
	io.sockets.emit('user', {connect: connections.length, time: today});
	// Функция, которая срабатывает при отключении от сервера
	socket.on('disconnect', function(data) {
		io.sockets.emit('user', {connect: connections.length});
		connections.splice(connections.indexOf(socket), 1);
	});
	// Функция получающая сообщение от какого-либо пользователя
	socket.on('send mess', function(data){
		if(data.name != "Консультант"){
			var dialog_id = md5(data.name + data.email); // Генерация chat_id
			socket.join(dialog_id);
			//Добавление диалога
			connection.query('SELECT MAX(id) FROM `tbl_dialog`', function (error, results, fields) {
				last_d_id = parseFloat(results[0]['MAX(id)'] + 1);
				//Проверка есть ли пользователь
				connection.query("SELECT * FROM `tbl_dialog` WHERE `dialog_id` = '"+dialog_id+"'", function (error, results, fields) {
					//Если нету пользователя
					if(results.length == 0){
						var que = "INSERT INTO `tbl_dialog` (`id`, `dialog_id`, `dialog_user_mail`, `dialog_user_id`, `dialog_time`, `dialog_mess_saw`) VALUES ('"+last_d_id+"', '"+dialog_id+"', '"+ data.email +"', '"+data.name+"', '"+today+"', '1')"
						connection.query(que, function (error, results, fields){
							if (error) throw error;
						});
					}
					//Запрос не прочитаного сообщения
					connection.query("UPDATE `tbl_dialog` SET `dialog_mess_saw` = '1' WHERE `tbl_dialog`.`dialog_id` = '"+ dialog_id +"'", function(error, results, fields){});
				});
			});
		}else{
			var dialog_id = data.dialog_id;
		}
		//Добавление сообщения в бд
		connection.query('SELECT MAX(id) FROM `tbl_message`', function (error, results, fields) {
			last_m_id = parseFloat(results[0]['MAX(id)'] + 1);
			if(data.mess != ""){
				var que = "INSERT INTO `tbl_message` (`id`, `chat_messages_text`, `chat_messages_fk_user_id`, `chat_messages_fk_dialog_id`, `chat_messages_time`) VALUES ('"+ last_m_id +"', '"+ data.mess +"', '"+ data.name +"', '"+ dialog_id +"', '"+ today +"');"	
			}else{
				var que = "";
			}
			connection.query(que, function (error, results, fields){
				//Добавление времени ласт сообщения для админ панели
				var today_now = new Date().toLocaleString();
				var que = "UPDATE `tbl_dialog` SET `dialog_last_time` = '" + today_now + "', `dialog_offline` = '"+ data.offline +"' WHERE `tbl_dialog`.`dialog_id` = '"+ dialog_id +"'";
				connection.query(que, function (error, results, fields){
					if (error) throw error;
						//Получение всех сообщений и рендринг
						connection.query("SELECT * FROM `tbl_message` WHERE `chat_messages_fk_dialog_id` LIKE '"+ dialog_id +"'", function (error, results, fields) { 
							if(results.length > 0){
								if(data.name != "Консультант"){
									if(data.offline == "false"){
										io.sockets.to(dialog_id).emit('render get', {mess: results, name: data.name}); // Отправка сообщения
									}
									io.sockets.emit('update',{}); //Обновление сообщений админа
								}else{
									io.sockets.to(dialog_id).emit('render get', {mess: results, name: results[0]['chat_messages_fk_user_id']}); // Обновление сообщений пользователя
									io.sockets.emit('update',{});
								}
							}
						});
				});
			});
		});
	});
	//Админ панель получение диалога выбраного пользователя в админ пенеле
	app.get('/adminPanel/api?:u', function(req, res){
		var dialog_id = req.query.u;
		connection.query("UPDATE `tbl_dialog` SET `dialog_mess_saw` = '0' WHERE `tbl_dialog`.`dialog_id` = '"+ dialog_id +"'", function(error, results, fields){});
		connection.query("SELECT * FROM `tbl_message` WHERE `chat_messages_fk_dialog_id` LIKE '"+ dialog_id +"'", function (error, results, fields) {
			connection.query("SELECT * FROM `tbl_dialog` WHERE `dialog_id` LIKE '"+ dialog_id +"'", function(error, results1, fields){
				if(results1[0] != undefined){
					results.unshift({mail: results1[0]['dialog_user_mail']});
				}
				res.json(results);
			});
		});
	});
	//Удалине диалога
	app.get('/adminPanel/api/delete?:u', function(req, res){
		var dialog_id = req.query.u;
		connection.query("DELETE FROM `tbl_dialog` WHERE `tbl_dialog`.`dialog_id` = '"+ dialog_id +"'", function(error, results, fields){});
		connection.query("DELETE FROM `tbl_message` WHERE `tbl_message`.`chat_messages_fk_dialog_id` = '"+ dialog_id +"'", function(error, results, fields){});
		res.json('ok');
	});
	//Получение юзеров
	app.get('/adminPanel/api/users?:p', function(req, res){
		var password = req.query.p;
		if(password != "6se3f9fD36uFMLL"){
			res.sendStatus(404);
		}else{
		var filter = req.query.f;
		connection.query('SELECT * FROM `tbl_dialog` ORDER BY `dialog_last_time` DESC', function (error, results, fields) {
			if(filter != "" && filter != undefined){
				var results = results.filter((item)=> {
					if(item['dialog_user_id'].toLowerCase().includes(filter) || item['dialog_user_mail'].toLowerCase().includes(filter)){return item;}
				});
			}
			res.json(results);
		});
		}
	});
	//Получение сообщений юзера
	app.get('/api?:u', function(req, res){
		var dialog_id = md5(req.query.u);
		connection.query("SELECT * FROM `tbl_message` WHERE `chat_messages_fk_dialog_id` LIKE '"+ dialog_id +"'", function (error, results, fields) {
			res.json(results);
		});
	});
	//Настройки админки
	app.get('/adminSettings/set?:p', function(req, res){
		var password = req.query.p;
		if(password != "6se3f9fD36uFMLL"){
			res.sendStatus(404);
		}else{
			var today = new Date().getHours();
			var minute = new Date().getMinutes();
			if(minute >= 40){
				today++;
			}
			if(req.query.o != undefined){
				connection.query("DELETE FROM `settings` WHERE `settings`.`id` = 0;", function (error, results, fields) {});
				connection.query("INSERT INTO `settings` (`id`, `offline`, `welcome`, `admin_move`) VALUES ('0', '"+ req.query.o +"', '"+ req.query.w +"', '"+ today +"')", function (error, results, fields) {
					res.json({status: 'ok'});
				});
			}else{
				connection.query("SELECT * FROM `settings`", function (error, results, fields) {
					if(results.length == 0){
						connection.query("INSERT INTO `settings` (`id`, `offline`, `welcome`, `admin_move`) VALUES ('0', 'on', '', '"+ today +"')", function (error, results, fields) {
						});
					}
				});
				connection.query("UPDATE `settings` SET `admin_move` = '"+ today +"' WHERE `settings`.`id` = 0", function (error, results, fields) {
					res.json({status: 'update_time'});
				});
			}
		}
	});
	app.get('/adminSettings/get', function(req, res){
		connection.query("SELECT * FROM `settings`", function (error, results, fields) {
			res.json(results);
		});
	});
});

//Авторизация в админ панеле
app.post('/adminPanel', urlencodedParser, function (req, res) {
	if(req.body.password == "6se3f9fD36uFMLL"){
		res.cookie('support', req.body.name);
		res.cookie('password', req.body.password,{ maxAge: 43200000 });
		res.redirect('/adminPanel');
	}
});