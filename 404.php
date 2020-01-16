<?php
/**
 * The template for displaying 404 pages (not found)
 *
 * @link https://codex.wordpress.org/Creating_an_Error_404_Page
 *
 * @package Mir_Detstva
 */

get_header();
?>

	<section class="error404">
        <div class="wrapper">
            <h2 class="title alt2">Упс...</h2>
            <p class="title alt2">Данной страницы не существует, вернитесь на главную страницу или перейдите в любой из доступных разделов меню.</p>
            <img src="<?php echo get_template_directory_uri(); ?>/assets/css/images/technical-support.png" alt="">
        </div>
    </section>

<?php
get_footer();
