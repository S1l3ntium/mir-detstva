<?php
/*
Template Name: Контакты
*/
get_header();
?>
        <section class="contacts">
            <div class="wrapper">
                <div class="contactsWrap">
                    <h1 class="title alt2">
                        Контактная информация </h1>
                    <h2>Телефоны</h2>
                    <a href="tel:+7 (900) 301-54-72" class="contData contPhone">
                        +7 (900) 301-54-72 </a>
                    <a href="tel:+7 (473) 258-64-20" class="contData contPhone">
                        +7 (473) 258-64-20 </a>
                    <h2>Электронная почта</h2>
                    <a href="mailto:sales-md@mail.ru" class="contData contEmail">
                        sales-md@mail.ru</a>
                    <a href="mailto:tdmd1@mail.ru" class="contData contEmail">
                        tdmd1@mail.ru</a>
                    <div class="contIndent1"></div>
                    <div class="contSubTitle">
                        Фактический адрес </div>
                    <p class="contData contAddr">
                        396830, Воронежская область, Хохольский район, село Хохол, ул. Ломоносова, д. 1, оф.2 </p>
                    <div class="contSubTitle">
                        Юридический адрес </div>
                    <p class="contData contAddr">
                        396830, Воронежская область, Хохольский район, село Хохол, ул. Ломоносова, д. 1, оф.2. </p>
                    <div class="contSubTitle">
                        Мы на карте </div>
                    <div class="contMap bgMap">
                        <yandex-map :coords="[51.635633, 39.251882]" :zoom="4" :scroll-zoom="false"
                                    :zoom-control="{options: {size: 'small', position: {left: 'auto', right: 10, top: 10, buttom: 'auto'}}}"
                                    :controls="['zoomControl']">
                            <ymap-marker :marker-id="1" :marker-type="'placemark'" :coords="[51.635633, 39.251882]"
                                         :balloon="{header: 'ООО «Мир Детства»', body: 'Самый разнообразный каталог товаров: от детских площадок до спортивных комплексов'}"
                                         :properties="{iconCaption: 'Мир Детства'}"
                                         :icon="{color: 'blue', glyph: 'StarCircle'}"></ymap-marker>
                        </yandex-map>
                    </div>
                    <div class="contactsFeedBack">
                        <?php echo do_shortcode('[contact-form-7 id="213" title="Contact Form"]') ?>
                    </div>
                </div>



                <aside class="contactsReq">
                    <div class="contReqWrap">
                        <div class="contReqItem">
                            <div class="contReqTitle">
                                Реквизиты фирмы </div>
                            <p class="contReqText">
                                Общество с ограниченной ответственностью ГК «МИР ДЕТСТВА» </p>
                            <p class="contReqText">
                                ИНН / КПП: 3631006641 / 363101001</p>
                            <p class="contReqText">
                                396830, Воронежская обл., Хохольский р-н, с. Хохол, ул. Ломоносова, д.1, оф. 2</p>
                        </div>
                        <div class="contReqItem">
                            <div class="contReqTitle">
                                Банковские реквизиты </div>
                            <p class="contReqText">
                                АО "АЛЬФА-БАНК" </p>
                            <p class="contReqText">
                                БИК: 044525593 </p>
                            <p class="contReqText">
                                р/с: 40702810202480000805 </p>
                            <p class="contReqText">
                                к/с: 30101810200000000593 </p>
                        </div>
                    </div>
                </aside>
            </div>
        </section>
    <?php get_footer(); ?>

