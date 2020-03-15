<?php
/*
Template Name: Услуги
*/
get_header();
?>
<section class="company">
    <div class="wrapper">
    <h2 class="title alt2">Монтаж</h2>
    <p class="text"><?php the_field('montazh'); ?></p>
    </div>
</section>
<section class="company">
    <div class="wrapper">
        <h2 class="title alt2">Реконструкция</h2>
        <p class="text">Также доступна реконструкция оборудования для детских площадок. Стоимость реконструкции завиист от типа оборудования и объема работы. Цены можно уточнить у нащих консультантов по телефону +7 (473) 258-64-20 и электронной почте, sales-md@mail.ru.
            <br> На фото, пример веранды на групповом участке детского сада до реконструкции и после. </p>
        <?php echo do_shortcode('[foogallery id="244"]') ?>
    </div>
</section>




<?php get_footer(); ?>