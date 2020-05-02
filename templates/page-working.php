<?php
/*
Template Name: Страница в разработке
*/
get_header();
?>
<section class="error404">
        <div class="wrapper">
            <h2 class="title alt2">Упс...</h2>
            <p class="title alt2">Данная страница находится в разработке, вернитесь на главную страницу или перейдите в любой из доступных разделов меню.</p>
            <img src="<?php echo get_template_directory_uri(); ?>/assets/css/images/technical-support.png" alt="">
        </div>
</section>
<?php get_footer(); ?>