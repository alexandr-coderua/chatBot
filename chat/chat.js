 // Функция которая получает куки
 function getCookie(name) {
    var matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}
if(getCookie('user')){
    $(".chat").addClass("hide").removeClass("showBox");
}
//Функиця которая удаляет куки   
function deleteAllCookies() {
    var cookies = document.cookie.split(";");
    for (var i = 0; i < cookies.length; i++) {
        var cookie = cookies[i];
        var eqPos = cookie.indexOf("=");
        var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
}
//Функция которая получает и рендрит сообщения
function getMessages(){
    $.get("/api?u="+getCookie('user')+getCookie('email')+"", function(data) {
        $('.all_messages').html('');
        $('.time').html(data[0]['chat_messages_time']);
        for(let i = 0; i <= data.length; i++){
            msg = data[i]['chat_messages_text'];
            if(data[i]['chat_messages_fk_user_id'] == getCookie('user')){
                var className = "me";
            }else{
                var className = "";
            }
            $('.all_messages').append("<div class='message "+ className +"'><b>" + data[i]['chat_messages_fk_user_id'] + "</b>: " + msg + "<div class='message-time'>"+ data[i]['chat_messages_time'] +"</div></div>");
            document.querySelector("#chat").scrollTop = document.querySelector("#chat").scrollHeight; //Скролл в конец
        }
    });
}
$(function() {
    //Получение настроек и онлайн ли админ
    $.get("/adminSettings/get" , function( data ) {
        var hours = new Date().getHours();
        if(data[0]['offline'] == "off"){
            $('.offline-quest').hide();
        }
        if(data[0]['welcome'] != ""){
            $('.welcome-mess').html(data[0]['welcome']);
        }
        if(data[0]['admin_move'] == hours || data[0]['admin_move'] == hours+1){
            $('.seen').html('Онлайн');
        }else{
            $('.seen').html('Оффлайн').css('color', '#fa2828');
            $('.offline-mess').show();
        }
    });
    //Анимация меню
    var chat = document.getElementById("chat_btn");
    var close = document.querySelector('.close-chat_btn');
    close.addEventListener('click', () => {
        document.querySelector("#chat").scrollTop = document.querySelector("#chat").scrollHeight; //Скролл в конец
        event.preventDefault();
        $(".chat").addClass("hide");
        $(".chat").removeClass("showBox");
    })
    chat.addEventListener("click", function(event) {
        event.preventDefault();
        if ($(".chat").hasClass("hide")) {
            $(".chat").removeClass("hide").addClass("showBox");
            chat.removeClass("showBox").addClass("hide");
        } else if (!$(".chat").hasClass("hide")) {
            $(".chat").addClass("hide").removeClass("showBox");
            $('.chat_btn').addClass("showBtn");
            chat.removeClass("hide").addClass("showBox");
        }
    });
    // Включаем socket.io и отслеживаем все подключения
    var socket = io.connect();
    // Селектим
    var $form = $(".message_form"); 
    var $textarea = $(".message_input");
    var $all_messages = $(".all_messages"); 
    var $form_auth = $(".authName");
    //Функция, скрытия когда авторизован
    //Офлайн вопрос
    document.querySelector('.offline-quest').addEventListener('click', () =>{
        if($('.offline-quest').html() == "Офлайн Вопрос"){
            $('.offline-quest').html('Чат');
            $('.authName').hide();
            $('.time').hide();
            $('.all_messages').hide();
            $('.offlineSend').show();
        }else{
            $('.offline-quest').html("Офлайн Вопрос");
            if(getCookie('user') != undefined && getCookie('email') != undefined){
                $('.time').show();
                $('.all_messages').show();
            }else{
                $('.authName').show();
            }
            $('.offlineSend').hide();
        }
    });
     //Выход с чата
    document.querySelector('.logout-chat').addEventListener('click', () =>{
        $form_auth.show();
        $all_messages.html('');
        $('.offlineSend').hide();
        $('.offline-quest').html('Офлайн Вопрос');
        $('.peoples_left').hide();
        $('.time').hide();
        $('.input form').css('display', 'none');
        deleteAllCookies();
    });
    //Скрытие авторизации
    function hideAuth(){
        $form_auth.hide();
        $('.peoples_left').show();
        $('.time').show();
        $('.input form').css('display', 'flex');
    }
    //Авторизация пользователя
    $form_auth.submit(function(event) {
        event.preventDefault();
        if($(".input_name").val() != "" && $(".email").val() != ""){
            document.cookie = "user="+$(".input_name").val();
            document.cookie = "email="+$(".email").val();
            hideAuth();
        }else{
            $('.input_name ,.email').css('border','2px solid red');
            $('.error_text').css('display','block');
        }
    });
    //Получение куки
    var name = getCookie('user');
    var email = getCookie('email');
    //Получение всех сообщений
    if(getCookie('user') != undefined){
        getMessages();
        hideAuth();
    }
    $('.send-message-ofline').click(() =>{
        event.preventDefault();
        if($('.formOffline .input_name').val() != "" && $('.formOffline .email').val() != ""){
            alert($('.input_name').val());
            socket.emit('send mess', {mess: $('.message_input-offline').val(), name: $('.formOffline .input_name').val() , email: $('.formOffline .email').val(), offline: "true"});
            $('.message_input-offline').val(''); 
            $('.input_name').val(''); 
            $('.email').val(''); 
        }else{
            $('.input_name ,.email').css('border','2px solid red');
            $('.error_text').css('display','block');
        };   
    });
    //Отравка сообщений
    $form.submit(function(event) {
        event.preventDefault();
        socket.emit('send mess', {mess: $textarea.val(), name: getCookie('user'), email: getCookie('email'), offline: "false"});
        $textarea.val('');
    });
    //Рендер новых сообщений
    socket.on('render get', function(data){
        $all_messages.html('');
        $('.time').html(data.mess[0]['chat_messages_time']);
        for(let i = 0; i <= data.mess.length; i++){
            msg = data.mess[i]['chat_messages_text'];
            if(data.mess[i]['chat_messages_fk_user_id'] == data.name){
                var className = "me";
            }else{
                var className = "";
            }
            $all_messages.append("<div class='message "+ className +"'><b>" + data.mess[i]['chat_messages_fk_user_id'] + "</b>: " + msg + "<div class='message-time'>"+ data.mess[i]['chat_messages_time'] +"</div></div>");
            document.querySelector("#chat").scrollTop = document.querySelector("#chat").scrollHeight; //Скролл в конец
        }
    });
});