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
                        <?php if (get_field('telSection')) : ?>
                            <?php while (have_rows('telSection')) : the_row();
                                $tS_tel = get_sub_field('tS_tel');
                                $tS_telhref = get_sub_field('tS_telhref');?>
                                    <a href="tel:<?php echo $tS_telhref;?>" class="contData contPhone"><?php echo $tS_tel;?></a>
                            <?php endwhile; ?>
                        <?php endif; ?>
                    <h2>Электронная почта</h2>
                        <?php if (get_field('emailSection')) : ?>
                                <?php while (have_rows('emailSection')) : the_row();
                                    $eS_email = get_sub_field('eS_email'); ?>
                                        <a href="mailto:<?php echo $eS_email; ?>" class="contData contEmail"><?php echo $eS_email; ?></a>
                                <?php endwhile; ?>
                        <?php endif; ?>
                    <h2>Наши адреса</h2>
                        <?php if (get_field('adressSection')) : ?>
                                <?php while (have_rows('adressSection')) : the_row();
                                    $aS_title = get_sub_field('aS_title');
                                    $aS_adress = get_sub_field('aS_adress'); ?>
                                        <div class="contSubTitle"><?php echo $aS_title ?></div>
                                        <p class="contData contAddr"><?php echo $aS_adress; ?></p>
                                <?php endwhile; ?>
                        <?php endif; ?>
                    <h2>Мы на карте</h2>
                    <div class="contMap bgMap">
                    <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2476.321538879745!2d39.24969331598926!3d51.63563630913957!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTHCsDM4JzA4LjMiTiAzOcKwMTUnMDYuOCJF!5e0!3m2!1sru!2sru!4v1585582284897!5m2!1sru!2sru" width="100%" height="100%" frameborder="0" style="border:0;" allowfullscreen="" aria-hidden="false" tabindex="0"></iframe>
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
                            <p class="contReqText"><?php the_field('requisitesSection'); ?></p>
                        </div>
                        <div class="contReqItem">
                            <div class="contReqTitle">
                                Банковские реквизиты </div>
                            <p class="contReqText"><?php the_field('bankRequisitesSection'); ?></p>
                        </div>
                    </div>
                </aside>
            </div>
        </section>


        



    <?php get_footer(); ?>

