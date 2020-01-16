<?php
/*
Template Name: Сертификаты
*/
get_header();
?>
    <section class="company">
        <div class="wrapper">
            <h2 class="title alt2">Сертификаты</h2>
            <p class="text">Мы награждены многими дипломами и наградами. Их вы можете увидеть ниже.</p>
            <?php echo do_shortcode('[foogallery id="225"]') ?>
        </div>
    </section>
<?php get_footer(); ?>